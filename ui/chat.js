(function () {
  const container = document.getElementById("chat-container");
  const form = document.getElementById("input-form");
  const input = document.getElementById("chat-input");
  const clearBtn = document.getElementById("chat-clear");

  // rotate the form and input names using the current epoch
  const epochName = Date.now().toString();
  form.name = `f-${epochName}`;
  input.name = `q-${epochName}`;

  const apiOrigin =
    window.location.port === "8081"
      ? window.location.origin.replace("8081", "8080")
      : window.location.origin;

  const addMsg = (cls, text) => {
    const div = document.createElement("div");
    div.className = cls;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  };

  input.addEventListener("input", () => {
    clearBtn.classList.toggle("visible", input.value !== "");
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.classList.remove("visible");
    input.focus();
  });

  const handle = async (query) => {
    addMsg("user", query);
    const parts = query.trim().split(/\s+/);
    let url = "";
    if (query.startsWith("purl ")) {
      const purl = encodeURIComponent(query.slice(5));
      url = `${apiOrigin}/purl/${purl}`;
    } else if (parts.length === 3) {
      const [mgr, name, ver] = parts;
      url = `${apiOrigin}/api/dependencies/${mgr}/${name}/${ver}`;
    } else if (parts.length === 4) {
      const [mgr, ns, name, ver] = parts;
      url = `${apiOrigin}/api/dependencies/${mgr}/${ns}/${name}/${ver}`;
    } else {
      addMsg(
        "bot",
        'Unrecognized format. Use "manager name version" or "manager namespace name version".',
      );
      return;
    }
    try {
      const resp = await fetch(url);
      const data = await resp.json();
      addMsg("bot", JSON.stringify(data, null, 2));
    } catch (err) {
      addMsg("bot", "Request failed");
    }
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    clearBtn.classList.remove("visible");
    handle(q);
  });
})();
