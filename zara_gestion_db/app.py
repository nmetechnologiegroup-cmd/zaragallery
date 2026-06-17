import flask
from flask import Flask, request, jsonify, render_template, send_file
import sqlite3
import json
import os
import io
import csv

app = Flask(__name__)
DB_FILE = 'zara_gestion.db'
JSON_FILE = 'zara_data.json'

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    # Optimisations
    conn.execute('PRAGMA journal_mode = WAL;')
    conn.execute('PRAGMA synchronous = NORMAL;')
    conn.execute('PRAGMA cache_size = -20000;')
    conn.execute('PRAGMA optimize;')
    return conn

def init_database():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            date TEXT,
            client_name TEXT,
            total REAL,
            payment_method TEXT,
            items TEXT,
            created_at TEXT
        )
    ''')
    conn.commit()
    conn.close()
    
    migrate_json_to_sqlite()

def migrate_json_to_sqlite():
    if not os.path.exists(JSON_FILE):
        return

    conn = get_db_connection()
    c = conn.cursor()
    
    c.execute('SELECT COUNT(*) FROM transactions')
    if c.fetchone()[0] > 0:
        conn.close()
        return

    try:
        with open(JSON_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            transactions = []
            if isinstance(data, list):
                transactions = data
            elif isinstance(data, dict):
                # Try to extract arrays typical of our export
                for key in ['orders', 'transactions', 'cashMovements']:
                    if key in data and isinstance(data[key], list):
                        transactions.extend(data[key])
                if not transactions:
                    for k, v in data.items():
                        if isinstance(v, list):
                            transactions.extend(v)

            for t in transactions:
                t_id = str(t.get('id', ''))
                t_date = str(t.get('date', ''))
                t_client = str(t.get('client_name', t.get('customerName', t.get('customer_name', ''))))
                t_total = float(t.get('total', 0.0))
                t_payment = str(t.get('payment_method', t.get('paymentMethod', '')))
                t_items = json.dumps(t.get('items', []))
                t_created = str(t.get('created_at', t.get('createdAt', t.get('date', ''))))
                
                c.execute('''
                    INSERT OR IGNORE INTO transactions 
                    (id, date, client_name, total, payment_method, items, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (t_id, t_date, t_client, t_total, t_payment, t_items, t_created))
                
        conn.commit()
    except Exception as e:
        print(f"Erreur durant l'importation: {e}")
    finally:
        conn.close()

init_database()

@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')

@app.route('/api/query', methods=['POST'])
def query():
    sql = request.json.get('sql', '')
    if not sql:
        return jsonify({'error': 'Requête SQL vide.'}), 400
        
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute(sql)
        
        if sql.strip().upper().startswith(('SELECT', 'PRAGMA')):
            rows = c.fetchall()
            columns = [description[0] for description in c.description] if c.description else []
            result = [dict(zip(columns, row)) for row in rows]
            conn.close()
            return jsonify({'columns': columns, 'rows': result})
        else:
            conn.commit()
            conn.close()
            return jsonify({'message': 'Requête exécutée avec succès.'})
            
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/export', methods=['POST'])
def export_data():
    req_data = request.json or {}
    sql = req_data.get('sql', '')
    export_format = req_data.get('format', 'csv')
    
    if not sql:
        return jsonify({'error': 'Requête SQL vide.'}), 400
        
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute(sql)
        rows = c.fetchall()
        columns = [description[0] for description in c.description] if c.description else []
        conn.close()

        if export_format.lower() == 'json':
            result = [dict(zip(columns, row)) for row in rows]
            json_data = json.dumps(result, ensure_ascii=False, indent=2)
            mem = io.BytesIO()
            mem.write(json_data.encode('utf-8'))
            mem.seek(0)
            return send_file(mem, mimetype='application/json', as_attachment=True, download_name='export.json')
            
        elif export_format.lower() == 'csv':
            mem = io.StringIO()
            writer = csv.writer(mem)
            writer.writerow(columns)
            for row in rows:
                writer.writerow(row)
            
            output = io.BytesIO()
            output.write(mem.getvalue().encode('utf-8'))
            output.seek(0)
            return send_file(output, mimetype='text/csv', as_attachment=True, download_name='export.csv')

        else:
            return jsonify({'error': 'Format non supporté.'}), 400

    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/maintenance/vacuum', methods=['POST'])
def vacuum():
    try:
        conn = get_db_connection()
        conn.execute('VACUUM;')
        conn.close()
        return jsonify({'message': 'VACUUM exécuté avec succès.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/maintenance/optimize', methods=['POST'])
def optimize():
    try:
        conn = get_db_connection()
        conn.execute('PRAGMA optimize;')
        conn.close()
        return jsonify({'message': 'PRAGMA optimize exécuté avec succès.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
