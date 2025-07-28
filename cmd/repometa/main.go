package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Println("usage: repometa <owner/repo>")
		os.Exit(1)
	}
	repo := os.Args[1]
	meta, err := fetchRepoMetadata(repo)
	if err != nil {
		fmt.Println("error:", err)
		os.Exit(1)
	}
	b, _ := json.MarshalIndent(meta, "", "  ")
	fmt.Println(string(b))
}

func fetchRepoMetadata(repo string) (map[string]interface{}, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s", repo)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	var info struct {
		Description   string `json:"description"`
		Language      string `json:"language"`
		Archived      bool   `json:"archived"`
		CreatedAt     string `json:"created_at"`
		UpdatedAt     string `json:"updated_at"`
		DefaultBranch string `json:"default_branch"`
		Watchers      int    `json:"watchers_count"`
		Subscribers   int    `json:"subscribers_count"`
		License       *struct {
			SPDX string `json:"spdx_id"`
			Name string `json:"name"`
		} `json:"license"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}
	watchers := info.Subscribers
	if watchers == 0 {
		watchers = info.Watchers
	}
	meta := map[string]interface{}{
		"description":    info.Description,
		"language":       info.Language,
		"archived":       info.Archived,
		"created":        info.CreatedAt,
		"updated":        info.UpdatedAt,
		"default_branch": info.DefaultBranch,
		"watchers":       watchers,
	}
	if info.License != nil {
		if info.License.SPDX != "" {
			meta["license"] = info.License.SPDX
		} else if info.License.Name != "" {
			meta["license"] = info.License.Name
		}
	}

	openCount, _ := searchPRs(repo, "open")
	closedCount, _ := searchPRs(repo, "closed")
	meta["pulls_open"] = openCount
	meta["pulls_closed"] = closedCount

	commits, last, _ := repoCommits(repo)
	meta["commit_count"] = commits
	if last != "" {
		meta["last_commit"] = last
	}

	return meta, nil
}

func searchPRs(repo, state string) (int, error) {
	url := fmt.Sprintf("https://api.github.com/search/issues?q=repo:%s+is:pr+state:%s&per_page=1", repo, state)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("status %d", resp.StatusCode)
	}
	var out struct {
		Total int `json:"total_count"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return 0, err
	}
	return out.Total, nil
}

func repoCommits(repo string) (int, string, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/commits?per_page=1", repo)
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, "", fmt.Errorf("status %d", resp.StatusCode)
	}
	var arr []struct {
		Commit struct {
			Author struct {
				Date string `json:"date"`
			} `json:"author"`
		} `json:"commit"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&arr); err != nil {
		return 0, "", err
	}
	last := ""
	if len(arr) > 0 {
		last = arr[0].Commit.Author.Date
	}
	count := 1
	if link := resp.Header.Get("Link"); link != "" {
		if p := parseLastPage(link); p > 0 {
			count = p
		}
	}
	return count, last, nil
}

func parseLastPage(link string) int {
	parts := strings.Split(link, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if strings.HasSuffix(p, "rel=\"last\"") {
			if i := strings.Index(p, "page="); i >= 0 {
				s := p[i+5:]
				for j := 0; j < len(s); j++ {
					if s[j] < '0' || s[j] > '9' {
						s = s[:j]
						break
					}
				}
				if n, err := strconv.Atoi(s); err == nil {
					return n
				}
			}
		}
	}
	return 1
}
