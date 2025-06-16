import os
import json
from flask import Flask, request, jsonify, session, send_from_directory
from dotenv import load_dotenv
import google.generativeai as genai
from base64 import b64encode, b64decode
from functools import wraps

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.secret_key = os.urandom(24) # Used for Flask sessions, change in production!

# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Data storage (in-memory for simplicity, use a database for production)
users_db = {} # username: encoded_password
user_data_db = {} # username: { 'syllabus': {}, 'progress': {}, 'summary': {} }

# Initialize users_db from a file if it exists (for persistent basic auth)
def load_users():
    try:
        with open('users.json', 'r') as f:
            global users_db
            users_db = json.load(f)
    except FileNotFoundError:
        pass # No users file yet

def save_users():
    with open('users.json', 'w') as f:
        json.dump(users_db, f)

# Initialize user_data_db from files if they exist
def load_user_data(username):
    try:
        with open(f'data/{username}_syllabus.json', 'r') as f:
            user_data_db.setdefault(username, {})['syllabus'] = json.load(f)
    except FileNotFoundError:
        user_data_db.setdefault(username, {})['syllabus'] = None # No syllabus yet

    try:
        with open(f'data/{username}_progress.json', 'r') as f:
            user_data_db.setdefault(username, {})['progress'] = json.load(f)
    except FileNotFoundError:
        user_data_db.setdefault(username, {})['progress'] = {} # No progress yet

    try:
        with open(f'data/{username}_summary.json', 'r') as f:
            user_data_db.setdefault(username, {})['summary'] = json.load(f)
    except FileNotFoundError:
        user_data_db.setdefault(username, {})['summary'] = None # No summary yet

def save_user_data(username):
    os.makedirs('data', exist_ok=True)
    if user_data_db.get(username, {}).get('syllabus'):
        with open(f'data/{username}_syllabus.json', 'w') as f:
            json.dump(user_data_db[username]['syllabus'], f)
    if user_data_db.get(username, {}).get('progress') is not None:
        with open(f'data/{username}_progress.json', 'w') as f:
            json.dump(user_data_db[username]['progress'], f)
    if user_data_db.get(username, {}).get('summary'):
        with open(f'data/{username}_summary.json', 'w') as f:
            json.dump(user_data_db[username]['summary'], f)


# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            return jsonify({'message': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- Frontend Routes ---
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# --- Authentication API Endpoints ---
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'message': 'Username and password are required'}), 400

    if username in users_db:
        return jsonify({'message': 'Username already exists'}), 409

    users_db[username] = b64encode(password.encode('utf-8')).decode('utf-8')
    save_users()
    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    remember_me = data.get('remember_me', False)

    if not username or not password:
        return jsonify({'message': 'Username and password are required'}), 400

    stored_password_encoded = users_db.get(username)
    if not stored_password_encoded:
        return jsonify({'message': 'Invalid username or password'}), 401

    try:
        stored_password = b64decode(stored_password_encoded).decode('utf-8')
    except Exception:
        return jsonify({'message': 'Authentication error'}), 500 # Corrupted password

    if password == stored_password:
        session['username'] = username
        if remember_me:
            session.permanent = True # Session lasts longer
        else:
            session.permanent = False
        return jsonify({'message': 'Logged in successfully', 'username': username}), 200
    else:
        return jsonify({'message': 'Invalid username or password'}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    session.pop('username', None)
    return jsonify({'message': 'Logged out successfully'}), 200

@app.route('/api/check_auth', methods=['GET'])
def check_auth():
    if 'username' in session:
        return jsonify({'username': session['username']}), 200
    return jsonify({'username': None}), 401

# --- Syllabus API Endpoints ---

@app.route('/api/parse_syllabus', methods=['POST'])
@login_required
def parse_syllabus():
    username = session['username']
    syllabus_text = request.form.get('syllabus_text')
    filename = request.form.get('filename') # You might want to save filename too

    if not syllabus_text:
        return jsonify({'message': 'No syllabus text provided'}), 400

    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""Parse the following syllabus text into a structured JSON object. The JSON should strictly conform to this schema:
{{
  "subjects": [
    {{
      "subjectName": "string",
      "units": [
        {{
          "unitName": "string",
          "topics": ["string"]
        }}
      ]
    }}
  ]
}}

If you cannot extract units for a subject, provide an empty array for "units". If a unit has no explicit topics, provide an empty array for "topics".
The syllabus text is:\n\n{syllabus_text}"""

        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        parsed_data = json.loads(response.text)

        user_data_db.setdefault(username, {})['syllabus'] = parsed_data
        save_user_data(username)

        return jsonify({'message': 'Syllabus parsed successfully', 'parsed_data': parsed_data}), 200
    except Exception as e:
        print(f"Error parsing syllabus with Gemini: {e}")
        return jsonify({'message': f'Failed to parse syllabus with AI: {str(e)}'}), 500

@app.route('/api/summarize_syllabus', methods=['POST'])
@login_required
def summarize_syllabus():
    username = session['username']
    data = request.get_json()
    parsed_syllabus = data.get('parsed_syllabus')

    if not parsed_syllabus:
        return jsonify({'message': 'No parsed syllabus data provided for summarization'}), 400

    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""Generate a comprehensive overall syllabus summary and detailed summaries for each subject and its topics based on the following structured syllabus data. The output should be a JSON object strictly conforming to this schema:
{{
  "overallSyllabusSummary": "string",
  "subjectsDetailedSummaries": [
    {{
      "subjectName": "string",
      "subjectSummary": "string",
      "topicSummaries": [
        {{
          "topicName": "string",
          "summary": "string"
        }}
      ]
    }}
  ]
}}
The structured syllabus data is:\n\n{json.dumps(parsed_syllabus, indent=2)}"""

        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        summarized_data = json.loads(response.text)

        user_data_db.setdefault(username, {})['summary'] = summarized_data
        save_user_data(username)

        return jsonify({'message': 'Syllabus summarized successfully', 'summarized_data': summarized_data}), 200
    except Exception as e:
        print(f"Error summarizing syllabus with Gemini: {e}")
        return jsonify({'message': f'Failed to summarize syllabus with AI: {str(e)}'}), 500

@app.route('/api/syllabus/<username>', methods=['GET'])
@login_required
def get_syllabus(username):
    if session['username'] != username:
        return jsonify({'message': 'Unauthorized access to syllabus data'}), 403
    load_user_data(username) # Ensure data is loaded
    syllabus_data = user_data_db.get(username, {}).get('syllabus')
    if syllabus_data:
        return jsonify(syllabus_data), 200
    return jsonify({'message': 'Syllabus not found for this user'}), 404

@app.route('/api/progress/<username>', methods=['GET'])
@login_required
def get_progress(username):
    if session['username'] != username:
        return jsonify({'message': 'Unauthorized access to progress data'}), 403
    load_user_data(username) # Ensure data is loaded
    progress_data = user_data_db.get(username, {}).get('progress', {})
    return jsonify(progress_data), 200

@app.route('/api/progress/<username>', methods=['POST'])
@login_required
def update_progress(username):
    if session['username'] != username:
        return jsonify({'message': 'Unauthorized access to progress data'}), 403
    progress_data = request.get_json()
    if not isinstance(progress_data, dict):
        return jsonify({'message': 'Invalid progress data format'}), 400

    user_data_db.setdefault(username, {})['progress'] = progress_data
    save_user_data(username)
    return jsonify({'message': 'Progress updated successfully'}), 200

@app.route('/api/summary/<username>', methods=['GET'])
@login_required
def get_summary(username):
    if session['username'] != username:
        return jsonify({'message': 'Unauthorized access to summary data'}), 403
    load_user_data(username) # Ensure data is loaded
    summary_data = user_data_db.get(username, {}).get('summary')
    if summary_data:
        return jsonify(summary_data), 200
    return jsonify({'message': 'Summary not found for this user'}), 404

if __name__ == '__main__':
    load_users()  # Load users on startup
    os.makedirs('data', exist_ok=True)  # Create 'data' directory if it doesn't exist
    port = int(os.environ.get('PORT', 5000))  # Use Render's PORT environment variable
    app.run(host='0.0.0.0', port=port)  # Bind to 0.0.0.0 for external access