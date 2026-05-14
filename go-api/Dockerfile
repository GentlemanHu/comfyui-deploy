FROM node:22-bookworm-slim AS ui-builder
WORKDIR /ui
COPY static-ui/package.json static-ui/package-lock.json ./
RUN npm ci
COPY static-ui ./
RUN npm run build

FROM golang:1.23-bookworm AS builder
WORKDIR /src

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/comfydeploy-go ./cmd/comfydeploy-go

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/comfydeploy-go /app/comfydeploy-go
COPY --from=ui-builder /ui/dist /app/static
EXPOSE 3000
ENTRYPOINT ["/app/comfydeploy-go"]
