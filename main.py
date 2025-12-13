import http.server
import socketserver
import socket

PORT = 8000

# 获取局域网 IP
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("8.8.8.8", 80))
    ip = s.getsockname()[0]
    s.close()
except:
    ip = "127.0.0.1"

print(f"\n✅ 服务已启动，请在 iPhone Safari 打开: http://{ip}:{PORT}\n")

Handler = http.server.SimpleHTTPRequestHandler
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
