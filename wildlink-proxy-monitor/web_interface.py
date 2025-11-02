#!/usr/bin/env python3
"""
Wildlink Proxy Monitor Web Interface
A Flask-based web interface to view and analyze captured network traffic.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template, jsonify, request, send_from_directory
from typing import Dict, List, Any, Optional

app = Flask(__name__)

class ProxyLogViewer:
    """Class to handle proxy log data and provide web interface functionality."""
    
    def __init__(self, log_file: str = "proxy-logs.json"):
        self.log_file = Path(log_file)
        
    def load_logs(self) -> List[Dict[str, Any]]:
        """Load proxy logs from JSON file."""
        if not self.log_file.exists():
            return []
            
        try:
            with open(self.log_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the logged traffic."""
        logs = self.load_logs()
        
        if not logs:
            return {
                "total_requests": 0,
                "completed_requests": 0,
                "pending_requests": 0,
                "domain_breakdown": {},
                "method_breakdown": {},
                "status_code_breakdown": {},
                "recent_activity": []
            }
        
        total_requests = len(logs)
        completed_requests = sum(1 for log in logs if log.get("completed", False))
        
        # Domain breakdown
        domain_counts = {}
        for log in logs:
            domain = log.get("hostname", "unknown")
            domain_counts[domain] = domain_counts.get(domain, 0) + 1
        
        # Method breakdown
        method_counts = {}
        for log in logs:
            method = log.get("method", "unknown")
            method_counts[method] = method_counts.get(method, 0) + 1
        
        # Status code breakdown
        status_counts = {}
        for log in logs:
            if log.get("completed", False):
                status = log.get("statusCode", "unknown")
                status_counts[str(status)] = status_counts.get(str(status), 0) + 1
        
        # Recent activity (last 10 requests)
        recent_activity = sorted(logs, key=lambda x: x.get("timestamp", ""), reverse=True)[:10]
        
        return {
            "total_requests": total_requests,
            "completed_requests": completed_requests,
            "pending_requests": total_requests - completed_requests,
            "domain_breakdown": domain_counts,
            "method_breakdown": method_counts,
            "status_code_breakdown": status_counts,
            "recent_activity": recent_activity,
            "log_file_size": self.log_file.stat().st_size if self.log_file.exists() else 0
        }
    
    def search_logs(self, 
                   domain: Optional[str] = None,
                   method: Optional[str] = None,
                   status_code: Optional[int] = None,
                   search_term: Optional[str] = None,
                   limit: int = 100) -> List[Dict[str, Any]]:
        """Search and filter proxy logs."""
        logs = self.load_logs()
        
        # Apply filters
        filtered_logs = []
        for log in logs:
            # Domain filter
            if domain and log.get("hostname", "").lower() != domain.lower():
                continue
                
            # Method filter
            if method and log.get("method", "").upper() != method.upper():
                continue
                
            # Status code filter
            if status_code and log.get("statusCode") != status_code:
                continue
                
            # Search term filter (searches in URL, headers, and body)
            if search_term:
                search_term_lower = search_term.lower()
                searchable_text = " ".join([
                    log.get("url", ""),
                    str(log.get("headers", {})),
                    str(log.get("requestBody", "")),
                    str(log.get("responseBody", ""))
                ]).lower()
                
                if search_term_lower not in searchable_text:
                    continue
            
            filtered_logs.append(log)
        
        # Sort by timestamp (newest first) and limit results
        filtered_logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return filtered_logs[:limit]

# Initialize log viewer
log_viewer = ProxyLogViewer()

@app.route('/')
def index():
    """Main dashboard page."""
    return render_template('index.html')

@app.route('/api/stats')
def api_stats():
    """API endpoint for statistics."""
    return jsonify(log_viewer.get_stats())

@app.route('/api/logs')
def api_logs():
    """API endpoint for log data with filtering."""
    domain = request.args.get('domain')
    method = request.args.get('method')
    status_code = request.args.get('status_code', type=int)
    search_term = request.args.get('search')
    limit = request.args.get('limit', 100, type=int)
    
    logs = log_viewer.search_logs(
        domain=domain,
        method=method,
        status_code=status_code,
        search_term=search_term,
        limit=limit
    )
    
    return jsonify(logs)

@app.route('/api/log/<log_id>')
def api_log_detail(log_id):
    """API endpoint for detailed log information."""
    logs = log_viewer.load_logs()
    
    for log in logs:
        if log.get("id") == log_id:
            return jsonify(log)
    
    return jsonify({"error": "Log not found"}), 404

@app.route('/logs')
def logs_page():
    """Logs viewing page."""
    return render_template('logs.html')

@app.route('/log/<log_id>')
def log_detail_page(log_id):
    """Individual log detail page."""
    return render_template('log_detail.html', log_id=log_id)

@app.route('/static/<path:filename>')
def static_files(filename):
    """Serve static files."""
    return send_from_directory('static', filename)

if __name__ == '__main__':
    print("🌐 Starting Wildlink Proxy Monitor Web Interface...")
    print("📊 Dashboard will be available at: http://localhost:5000")
    print("📋 Logs viewer at: http://localhost:5000/logs")
    
    # Create templates and static directories if they don't exist
    Path("templates").mkdir(exist_ok=True)
    Path("static").mkdir(exist_ok=True)
    
    app.run(debug=True, host='0.0.0.0', port=5000)
