from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import json

app = Flask(__name__)
CORS(app)

# 关卡数据
LEVELS = [
    {
        "id": 1,
        "name": "初识一笔",
        "description": "连接所有节点，完成一笔画",
        "nodes": [
            {"id": "n1", "x": 150, "y": 200, "type": "normal"},
            {"id": "n2", "x": 350, "y": 200, "type": "normal"},
            {"id": "n3", "x": 250, "y": 350, "type": "normal"}
        ],
        "connections": [
            {"from": "n1", "to": "n2", "type": "straight"},
            {"from": "n2", "to": "n3", "type": "straight"},
            {"from": "n3", "to": "n1", "type": "straight"}
        ],
        "startNode": "n1",
        "requiredVisits": {"n1": 1, "n2": 1, "n3": 1}
    },
    {
        "id": 2,
        "name": "曲线初探",
        "description": "学习使用贝塞尔曲线连接节点",
        "nodes": [
            {"id": "n1", "x": 150, "y": 200, "type": "normal"},
            {"id": "n2", "x": 350, "y": 200, "type": "normal"},
            {"id": "n3", "x": 250, "y": 100, "type": "normal"},
            {"id": "n4", "x": 250, "y": 350, "type": "normal"}
        ],
        "connections": [
            {"from": "n1", "to": "n2", "type": "straight"},
            {"from": "n2", "to": "n3", "type": "bezier", "controlPoints": [[300, 150]]},
            {"from": "n3", "to": "n4", "type": "straight"},
            {"from": "n4", "to": "n1", "type": "bezier", "controlPoints": [[200, 300]]},
            {"from": "n1", "to": "n3", "type": "straight"},
            {"from": "n2", "to": "n4", "type": "straight"}
        ],
        "startNode": "n1",
        "requiredVisits": {"n1": 1, "n2": 1, "n3": 1, "n4": 1}
    },
    {
        "id": 3,
        "name": "单向通道",
        "description": "注意箭头方向，只能单向通过",
        "nodes": [
            {"id": "n1", "x": 150, "y": 150, "type": "normal"},
            {"id": "n2", "x": 350, "y": 150, "type": "normal"},
            {"id": "n3", "x": 350, "y": 350, "type": "normal"},
            {"id": "n4", "x": 150, "y": 350, "type": "normal"}
        ],
        "connections": [
            {"from": "n1", "to": "n2", "type": "oneway", "direction": "forward"},
            {"from": "n2", "to": "n3", "type": "straight"},
            {"from": "n3", "to": "n4", "type": "oneway", "direction": "forward"},
            {"from": "n4", "to": "n1", "type": "straight"},
            {"from": "n1", "to": "n3", "type": "straight"},
            {"from": "n2", "to": "n4", "type": "oneway", "direction": "forward"}
        ],
        "startNode": "n1",
        "requiredVisits": {"n1": 1, "n2": 1, "n3": 1, "n4": 1}
    },
    {
        "id": 4,
        "name": "重复路径",
        "description": "某些路径可以重复使用，但有次数限制",
        "nodes": [
            {"id": "n1", "x": 150, "y": 200, "type": "normal"},
            {"id": "n2", "x": 250, "y": 100, "type": "normal"},
            {"id": "n3", "x": 350, "y": 200, "type": "normal"},
            {"id": "n4", "x": 250, "y": 300, "type": "normal"},
            {"id": "n5", "x": 250, "y": 200, "type": "normal"}
        ],
        "connections": [
            {"from": "n1", "to": "n5", "type": "repeatable", "maxUses": 2},
            {"from": "n5", "to": "n2", "type": "straight"},
            {"from": "n2", "to": "n3", "type": "straight"},
            {"from": "n3", "to": "n5", "type": "repeatable", "maxUses": 2},
            {"from": "n5", "to": "n4", "type": "straight"},
            {"from": "n4", "to": "n1", "type": "straight"}
        ],
        "startNode": "n1",
        "requiredVisits": {"n1": 1, "n2": 1, "n3": 1, "n4": 1, "n5": 1}
    },
    {
        "id": 5,
        "name": "幻影挑战",
        "description": "幻影节点只能访问一次，访问后消失",
        "nodes": [
            {"id": "n1", "x": 150, "y": 200, "type": "normal"},
            {"id": "n2", "x": 250, "y": 100, "type": "phantom"},
            {"id": "n3", "x": 350, "y": 200, "type": "normal"},
            {"id": "n4", "x": 250, "y": 300, "type": "normal"}
        ],
        "connections": [
            {"from": "n1", "to": "n2", "type": "straight"},
            {"from": "n2", "to": "n3", "type": "straight"},
            {"from": "n3", "to": "n4", "type": "straight"},
            {"from": "n4", "to": "n1", "type": "straight"},
            {"from": "n1", "to": "n3", "type": "straight"},
            {"from": "n2", "to": "n4", "type": "straight"}
        ],
        "startNode": "n1",
        "requiredVisits": {"n1": 1, "n2": 1, "n3": 1, "n4": 1}
    },
    {
        "id": 6,
        "name": "综合挑战",
        "description": "综合运用所有机制完成挑战",
        "nodes": [
            {"id": "n1", "x": 100, "y": 150, "type": "normal"},
            {"id": "n2", "x": 200, "y": 100, "type": "phantom"},
            {"id": "n3", "x": 300, "y": 100, "type": "normal"},
            {"id": "n4", "x": 400, "y": 150, "type": "normal"},
            {"id": "n5", "x": 400, "y": 250, "type": "normal"},
            {"id": "n6", "x": 300, "y": 300, "type": "normal"},
            {"id": "n7", "x": 200, "y": 300, "type": "normal"},
            {"id": "n8", "x": 100, "y": 250, "type": "normal"}
        ],
        "connections": [
            {"from": "n1", "to": "n2", "type": "oneway", "direction": "forward"},
            {"from": "n2", "to": "n3", "type": "bezier", "controlPoints": [[250, 80]]},
            {"from": "n3", "to": "n4", "type": "straight"},
            {"from": "n4", "to": "n5", "type": "repeatable", "maxUses": 2},
            {"from": "n5", "to": "n6", "type": "straight"},
            {"from": "n6", "to": "n7", "type": "oneway", "direction": "forward"},
            {"from": "n7", "to": "n8", "type": "bezier", "controlPoints": [[150, 320]]},
            {"from": "n8", "to": "n1", "type": "straight"},
            {"from": "n1", "to": "n5", "type": "straight"},
            {"from": "n3", "to": "n7", "type": "repeatable", "maxUses": 2}
        ],
        "startNode": "n1",
        "requiredVisits": {"n1": 1, "n2": 1, "n3": 1, "n4": 1, "n5": 1, "n6": 1, "n7": 1, "n8": 1}
    }
]

# 通关插画数据
LEVEL_ILLUSTRATIONS = {
    1: {
        "type": "star",
        "points": [[250, 50], [270, 90], [310, 90], [280, 120], [290, 160], [250, 140], [210, 160], [220, 120], [190, 90], [230, 90]]
    },
    2: {
        "type": "heart",
        "points": [[250, 100], [290, 60], [330, 60], [350, 80], [350, 120], [310, 170], [250, 220], [190, 170], [150, 120], [150, 80], [170, 60], [210, 60]]
    },
    3: {
        "type": "diamond",
        "points": [[250, 50], [350, 150], [250, 250], [150, 150]]
    },
    4: {
        "type": "flower",
        "points": [[250, 80], [280, 100], [300, 70], [290, 100], [320, 110], [290, 120], [300, 150], [280, 120], [250, 130], [220, 120], [200, 150], [210, 120], [180, 110], [210, 100], [200, 70], [220, 100]]
    },
    5: {
        "type": "moon",
        "points": [[300, 80], [320, 100], [330, 130], [330, 170], [320, 200], [300, 220], [280, 200], [290, 180], [295, 150], [290, 120], [280, 100]]
    },
    6: {
        "type": "crown",
        "points": [[150, 200], [170, 120], [210, 160], [250, 80], [290, 160], [330, 120], [350, 200], [330, 200], [310, 220], [190, 220], [170, 200]]
    }
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/levels', methods=['GET'])
def get_levels():
    return jsonify({"levels": LEVELS})

@app.route('/api/levels/<int:level_id>', methods=['GET'])
def get_level(level_id):
    for level in LEVELS:
        if level['id'] == level_id:
            return jsonify(level)
    return jsonify({"error": "Level not found"}), 404

@app.route('/api/levels/<int:level_id>/illustration', methods=['GET'])
def get_illustration(level_id):
    if level_id in LEVEL_ILLUSTRATIONS:
        return jsonify(LEVEL_ILLUSTRATIONS[level_id])
    return jsonify({"error": "Illustration not found"}), 404

@app.route('/api/verify-path', methods=['POST'])
def verify_path():
    try:
        data = request.get_json()
        level_id = data.get('levelId')
        path = data.get('path')
        
        # 找到对应的关卡
        level = None
        for l in LEVELS:
            if l['id'] == level_id:
                level = l
                break
        
        if not level:
            return jsonify({"valid": False, "message": "关卡不存在"})
        
        # 验证路径是否覆盖所有节点
        visited_nodes = set()
        for step in path:
            visited_nodes.add(step['from'])
            visited_nodes.add(step['to'])
        
        all_nodes = set(node['id'] for node in level['nodes'])
        
        if visited_nodes != all_nodes:
            return jsonify({"valid": False, "message": "未访问所有节点"})
        
        # 验证路径连通性
        if not is_path_connected(path, level):
            return jsonify({"valid": False, "message": "路径不连通"})
        
        return jsonify({"valid": True, "message": "路径有效"})
    
    except Exception as e:
        return jsonify({"valid": False, "message": str(e)})

def is_path_connected(path, level):
    if not path:
        return False
    
    # 检查每一步是否连接
    for i in range(len(path) - 1):
        if path[i]['to'] != path[i+1]['from']:
            return False
    
    return True

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5734, debug=True)
