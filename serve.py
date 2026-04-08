#!/usr/bin/env python3
"""Attribution graph 前端 server。纯标准库，无第三方依赖。

前端静态文件从脚本所在目录提供，graph JSON 从 --data-dir 读取。
前端通过 /data/ 或 /graph_data/ 路径请求 JSON 数据。

Usage:
    python3 serve.py [--data-dir PATH] [--port PORT]
"""

import argparse
import functools
import http.server
import json
import os
import socketserver


class Handler(http.server.SimpleHTTPRequestHandler):
    """静态文件 + graph JSON 数据路由。"""

    def __init__(self, *args, data_dir, **kwargs):
        self.data_dir = data_dir
        super().__init__(*args, **kwargs)

    def do_GET(self):
        # /data/ 和 /graph_data/ 路由到 data_dir
        for prefix in ("/data/", "/graph_data/"):
            if self.path.startswith(prefix):
                rel = self.path[len(prefix):].split("?")[0]
                path = os.path.join(self.data_dir, rel)
                if not os.path.exists(path):
                    self.send_error(404)
                    return
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                with open(path, "rb") as f:
                    self.wfile.write(f.read())
                return
        # 其余走静态文件
        super().do_GET()

    def do_POST(self):
        # /save_graph/<slug> — 保存前端的 layout 参数
        if not self.path.startswith("/save_graph/"):
            self.send_error(404)
            return
        slug = self.path.strip("/").split("/")[-1]
        body = self.rfile.read(int(self.headers["Content-Length"]))
        data = json.loads(body)
        path = os.path.join(self.data_dir, f"{slug}.json")
        with open(path) as f:
            graph = json.load(f)
        graph["qParams"] = data["qParams"]
        with open(path, "w") as f:
            json.dump(graph, f, indent=2)
        self.send_response(200)
        self.end_headers()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-dir", default=os.path.join(os.path.dirname(__file__), "..", "..", "outputs", "graph_files"))
    parser.add_argument("--port", type=int, default=8041)
    args = parser.parse_args()

    data_dir = os.path.abspath(args.data_dir)
    frontend_dir = os.path.abspath(os.path.dirname(__file__))

    handler = functools.partial(Handler, directory=frontend_dir, data_dir=data_dir)
    socketserver.TCPServer.allow_reuse_address = True
    server = socketserver.TCPServer(("", args.port), handler)

    print(f"http://localhost:{args.port}")
    print(f"  frontend: {frontend_dir}")
    print(f"  data: {data_dir}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
