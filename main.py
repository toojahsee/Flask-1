import os
from flask import Flask, render_template, send_from_directory, request, jsonify
from flask_cors import CORS
import requests
import glob

app = Flask(__name__)
CORS(app)

# ✅ 提供 Vite 构建后的静态资源访问
@app.route('/vite/<path:filename>')
def vite_static(filename):
    return send_from_directory('scr_dist/assets', filename)

# ✅ 首页
@app.route('/')
def index():
    return render_template('index.html')

# ✅ /game 页面动态注入构建后的 vite js
@app.route('/game')
def game():
    vite_files = glob.glob('scr_dist/assets/game-*.js')
    vite_script_js = None
    if vite_files:
        vite_script_js = os.path.basename(vite_files[0])  # 只取文件名（不含路径）
    return render_template('game.html', vite_script_js=vite_script_js)

# ✅ 接口：AI move
@app.route('/move', methods=['POST'])
def get_best_move():
    data = request.get_json()
    fen = data.get('fen')
    try:
        res = requests.get("https://stockfish.online/api/s/v2.php", params={
            "fen": fen,
            "depth": 15
        })
        res.raise_for_status()
        move_data = res.json()
        if not move_data.get("success", False):
            return jsonify({"error": "Stockfish API 返回失败"}), 500

        raw_bestmove = move_data.get("bestmove", "")
        move_parts = raw_bestmove.split()
        if len(move_parts) >= 2 and move_parts[0] == "bestmove":
            actual_move = move_parts[1]
        else:
            actual_move = raw_bestmove

        if not actual_move:
            return jsonify({"error": "无法解析 bestmove"}), 500

        return jsonify({"best_move": actual_move})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ✅ 启动应用
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))  # Railway 或 Replit 用这个
    app.run(host='0.0.0.0', port=port, debug=True)