# Servidor de pruebas: sirve esta carpeta como `python3 -m http.server`, pero
# dice al navegador que pregunte siempre si hay versión nueva
# (`Cache-Control: no-cache`). Sin eso, el navegador puede seguir usando
# durante horas una copia vieja de los archivos, sobre todo al probar desde el
# móvil por la red de casa (http://192.168.x.x:5173), donde el service worker no
# funciona porque no es https ni localhost.
#
#   python3 tools/serve.py [puerto]      (por defecto, 5173; es lo que hace `npm start`)

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    handler = partial(NoCacheHandler, directory=str(ROOT))
    with ThreadingHTTPServer(('', port), handler) as server:
        print(f'Mama Pop en http://localhost:{port} (sin copias viejas en el navegador)')
        server.serve_forever()
