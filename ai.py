# ai.py
import requests
from flask import jsonify

def get_best_move_api(request):
    data = request.get_json()
    fen = data.get('fen')
    mode = data.get('mode')

    if not fen:
        return jsonify({"error": "缺少 FEN 参数"}), 400
    if mode == 'online':
        return jsonify({"message": "在线模式，不调用 AI"}), 200

    try:
        res = requests.get("https://stockfish.online/api/s/v2.php", params={"fen": fen, "depth": 15})
        res.raise_for_status()
        move_data = res.json()

        if not move_data.get("success", False):
            return jsonify({"error": "Stockfish API 返回失败"}), 500

        raw_bestmove = move_data.get("bestmove", "")
        move_parts = raw_bestmove.split()
        actual_move = move_parts[1] if len(move_parts) >= 2 and move_parts[0] == "bestmove" else raw_bestmove

        if not actual_move:
            return jsonify({"error": "无法解析 bestmove"}), 500

        return jsonify({"best_move": actual_move})

    except Exception as e:
        return jsonify({"error": str(e)}), 500