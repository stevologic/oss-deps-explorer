# Build stage
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /oss-deps-explorer ./cmd/oss-deps-explorer

# Runtime stage
FROM alpine:3.21
RUN adduser -D app
USER app
COPY --from=build /oss-deps-explorer /usr/local/bin/oss-deps-explorer
COPY config.yaml /app/config.yaml
EXPOSE 8080
CMD ["oss-deps-explorer", "-config", "/app/config.yaml"]
