from flask import request
from flask_socketio import SocketIO, join_room, leave_room, emit
import threading

# 房间数据结构示例：
# rooms = {
#   "ROOMID": {
#       "players": { sid1: "white", sid2: "black" },
#       "ready": set([sid1, sid2])
#   }
# }
rooms = {}
rooms_lock = threading.Lock()

def register_socketio_events(socketio: SocketIO, app):

    def remove_player_from_room(sid):
        with rooms_lock:
            for room_id, room_data in list(rooms.items()):
                if sid in room_data['players']:
                    color = room_data['players'][sid]
                    leave_room(room_id)

                    emit('status', {'msg': f"玩家 {sid[:5]} ({color}) 离开了房间"}, room=room_id)
                    emit('opponent_left', {}, room=room_id)

                    del room_data['players'][sid]
                    room_data['ready'].discard(sid)

                    if not room_data['players']:
                        del rooms[room_id]
                        print(f"[删除房间] {room_id} 因无玩家")
                    else:
                        # 清理 ready 集合中不存在的玩家sid，防止残留
                        valid_ready = set(room_data['players'].keys()) & room_data['ready']
                        if valid_ready != room_data['ready']:
                            print(f"[清理ready] 原始ready={room_data['ready']} -> 清理后={valid_ready}")
                            room_data['ready'] = valid_ready

                        players_info = []
                        for s, c in room_data['players'].items():
                            players_info.append({
                                'sid': s,
                                'color': c,
                                'ready': s in room_data['ready']
                            })
                        emit('player_left', {'players': players_info}, room=room_id)
                    break

    @socketio.on('connect')
    def on_connect():
        print(f"[Socket] 连接: {request.sid}")

    @socketio.on('disconnect')
    def on_disconnect():
        sid = request.sid
        print(f"[Socket] 断开连接: {sid}")
        remove_player_from_room(sid)

    @socketio.on('join')
    def on_join(data):
        room_id = data.get('room', '').upper()
        sid = request.sid
        if not room_id:
            emit('error', {'message': '无效房间号'})
            return

        with rooms_lock:
            if room_id not in rooms:
                rooms[room_id] = {'players': {}, 'ready': set()}

            room = rooms[room_id]

            # 防止同一个 sid 重复加入
            if sid in room['players']:
                # 再次确认ready集合无误
                valid_ready = set(room['players'].keys()) & room['ready']
                if valid_ready != room['ready']:
                    print(f"[清理ready] 原始ready={room['ready']} -> 清理后={valid_ready}")
                    room['ready'] = valid_ready

                players_info = []
                for s, c in room['players'].items():
                    players_info.append({
                        'sid': s,
                        'color': c,
                        'ready': s in room['ready']
                    })

                emit('already_joined', {
                    'your_sid': sid,
                    'your_color': room['players'][sid],
                    'players': players_info,
                    'ready': len(room['ready']) == len(room['players']) and len(room['players']) == 2
                }, to=sid)
                return

            if len(room['players']) >= 2:
                emit('room_full', {'message': '房间已满'}, to=sid)
                return

            assigned_colors = room['players'].values()
            if 'white' not in assigned_colors:
                color = 'white'
            elif 'black' not in assigned_colors:
                color = 'black'
            else:
                emit('room_full', {'message': '房间颜色已满'}, to=sid)
                return

            room['players'][sid] = color
            room['ready'].add(sid)  # 自动准备

            # 再次清理ready，确保没有多余的sid
            valid_ready = set(room['players'].keys()) & room['ready']
            if valid_ready != room['ready']:
                print(f"[清理ready] 原始ready={room['ready']} -> 清理后={valid_ready}")
                room['ready'] = valid_ready

            players_info = []
            for s, c in room['players'].items():
                players_info.append({
                    'sid': s,
                    'color': c,
                    'ready': s in room['ready']
                })

            join_room(room_id)

            emit('joined', {
                'your_sid': sid,
                'your_color': color,
                'players': players_info,
                'ready': len(room['ready']) == len(room['players']) == 2
            }, to=sid)

            emit('player_joined', {
                'players': players_info
            }, room=room_id)

            print(f"[房间状态] {room_id} 玩家数: {len(room['players'])}, 准备数: {len(room['ready'])}")
            print(f"-> 玩家详情: {players_info}")

            # 两人都准备了，开始游戏
            if len(room['ready']) == 2 and len(room['players']) == 2:
                emit('start', {'players': [
                    {
                        'sid': s,
                        'color': c,
                        'ready': True
                    } for s, c in room['players'].items()
                ]}, room=room_id)

    @socketio.on('move')
    def on_move(data):
        room_id = data.get('room', '').upper()
        move = data.get('move')
        sid = request.sid

        if not room_id or not move:
            return

        with rooms_lock:
            if room_id not in rooms or sid not in rooms[room_id]['players']:
                return

        # 向除自己以外房间内玩家广播走子
        emit('move', {'move': move}, room=room_id, include_self=False)

    @socketio.on('restart')
    def on_restart(data):
        room_id = data.get('room', '').upper()
        sid = request.sid

        if not room_id:
            return

        with rooms_lock:
            if room_id not in rooms or sid not in rooms[room_id]['players']:
                return

            # 重置准备状态，默认所有玩家都准备好
            rooms[room_id]['ready'] = set(rooms[room_id]['players'].keys())

            emit('restart', {}, room=room_id)
            emit('start', {'players': [
                {
                    'sid': s,
                    'color': c,
                    'ready': True
                } for s, c in rooms[room_id]['players'].items()
            ]}, room=room_id)