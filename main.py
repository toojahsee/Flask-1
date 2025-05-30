from flask import Flask, render_template, request, jsonify
import os
import requests
from flask_cors import CORS

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)  # 允许跨域请求

@app.route('/')
def index():
    return render_template('game.html')

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

        # 处理 bestmove 字符串，兼容多种格式
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port, debug=True)