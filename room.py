import threading
from flask import jsonify, request

# 房间信息：{room_id: {"players": [sid1, sid2]}}
rooms = {}
rooms_lock = threading.Lock()  # ✅ 确保线程安全访问 rooms

def create_room(room_id=None):
    """
    创建房间，如果传入房间号且房间不存在则创建。
    返回创建的房间信息或错误。
    """
    if room_id:
        room_id = room_id.upper()
        with rooms_lock:
            if room_id not in rooms:
                rooms[room_id] = {'players': []}
                print(f"[创建房间] 房间号：{room_id}")
        return {'room': room_id}
    return {'error': '未指定房间号'}

def get_room_info_api(room_id):
    """
    通过API调用获取房间信息。
    如果房间不存在则自动创建。
    返回 JSON，包含房间号和当前玩家数，或错误。
    """
    room_id = room_id.upper()
    with rooms_lock:
        if room_id not in rooms:
            rooms[room_id] = {'players': []}
            print(f"[自动创建房间] {room_id}")

        player_count = len(rooms[room_id]['players'])
        if player_count >= 2:
            return jsonify({"error": "房间已满"}), 403

        return jsonify({
            "room": room_id,
            "player_count": player_count
        })

def get_rooms_dict():
    """
    返回当前房间字典，供其他模块使用。
    """
    return rooms

def get_room_players(room_id):
    """
    获取指定房间的玩家列表。
    如果房间不存在，返回 None。
    """
    room_id = room_id.upper()
    with rooms_lock:
        if room_id not in rooms:
            return None
        return rooms[room_id]['players']

def register_room_routes(app):
    """
    注册房间相关的 Flask 路由。
    提供 /check_room 接口，用于检查房间状态。
    """
    @app.route('/check_room')
    def check_room_route():
        room_id = request.args.get('room', '').upper()
        if not room_id:
            return jsonify({"error": "缺少 room 参数"}), 400

        with rooms_lock:
            if room_id not in rooms:
                rooms[room_id] = {'players': []}
                print(f"[自动创建房间 - check] {room_id}")

            player_count = len(rooms[room_id]['players'])
            if player_count >= 2:
                return jsonify({"error": "房间已满"}), 403

            return jsonify({
                "room": room_id,
                "player_count": player_count
            })