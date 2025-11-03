#!/usr/bin/env python3
"""
Wildlink Network Traffic Monitor
A mitmproxy-based service to capture and analyze network traffic from Wildlink domains.
"""

import json
import hashlib
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
from urllib.parse import urlparse, parse_qs
import mitmproxy
from mitmproxy import http, ctx
from mitmproxy.tools.dump import DumpMaster
from mitmproxy.options import Options


class WildlinkProxyMonitor:
    """Main proxy monitor class for capturing Wildlink traffic."""
    
    def __init__(self, log_file: str = "proxy-logs.json", max_requests: int = 10000):
        self.log_file = Path(log_file)
        self.max_requests = max_requests
        self.requests_data = []
        
        # Target domains to monitor
        self.target_domains = {
            'storage.googleapis.com',  # For /wildlink paths
            'wildlink.me',
            'www.wildlink.me', 
            'wildlink.ai',
            'wild.link',
            'wfi.re'
        }
        
        # Important query parameters to extract
        self.important_params = {
            'd', 's', 'io', 'c', 'tc', 'st', 'nm', 
            'sender', 'device', 'auth', 'token', 'id', 'uid'
        }
        
        # Load existing data
        self._load_existing_data()
        
        print(f"🚀 Wildlink Proxy Monitor initialized")
        print(f"📁 Log file: {self.log_file.absolute()}")
        print(f"🎯 Monitoring domains: {', '.join(self.target_domains)}")
        print(f"📊 Max requests to keep: {self.max_requests}")

    def _load_existing_data(self):
        """Load existing proxy logs if they exist."""
        if self.log_file.exists():
            try:
                with open(self.log_file, 'r', encoding='utf-8') as f:
                    self.requests_data = json.load(f)
                print(f"📂 Loaded {len(self.requests_data)} existing requests")
            except (json.JSONDecodeError, FileNotFoundError):
                print("⚠️  Could not load existing data, starting fresh")
                self.requests_data = []
        else:
            self.requests_data = []

    def _should_monitor_request(self, flow: http.HTTPFlow) -> bool:
        """Check if this request should be monitored based on domain filtering."""
        hostname = flow.request.pretty_host.lower()
        
        # Check direct domain matches
        if hostname in self.target_domains:
            return True
            
        # Check for subdomains of wildlink.me and wildlink.ai
        if (hostname.endswith('.wildlink.me') or 
            hostname.endswith('.wildlink.ai')):
            return True
            
        # Special case for Google Cloud Storage wildlink bucket
        if (hostname == 'storage.googleapis.com' and 
            ('/wildlink' in flow.request.path or flow.request.path.startswith('/wildlink'))):
            return True
            
        return False

    def _generate_request_id(self, flow: http.HTTPFlow) -> str:
        """Generate unique ID for request."""
        timestamp = str(int(time.time() * 1000))
        url_hash = hashlib.md5(flow.request.pretty_url.encode()).hexdigest()[:8]
        return f"{timestamp}-{url_hash}"

    def _extract_query_params(self, url: str) -> Dict[str, Any]:
        """Extract all query parameters from URL."""
        parsed = urlparse(url)
        return {k: v[0] if len(v) == 1 else v for k, v in parse_qs(parsed.query).items()}

    def _filter_important_params(self, all_params: Dict[str, Any]) -> Dict[str, Any]:
        """Filter query parameters to only important ones."""
        return {k: v for k, v in all_params.items() if k in self.important_params}

    def _get_request_body(self, flow: http.HTTPFlow) -> Optional[str]:
        """Extract request body content."""
        if flow.request.content:
            try:
                # Try to decode as text
                return flow.request.content.decode('utf-8')
            except UnicodeDecodeError:
                # If binary, return base64 encoded
                import base64
                return f"[BINARY DATA - Base64]: {base64.b64encode(flow.request.content).decode('ascii')}"
        return None

    def _get_response_body(self, flow: http.HTTPFlow) -> Optional[str]:
        """Extract response body content."""
        if flow.response and flow.response.content:
            try:
                # Try to decode as text
                return flow.response.content.decode('utf-8')
            except UnicodeDecodeError:
                # If binary, return base64 encoded
                import base64
                return f"[BINARY DATA - Base64]: {base64.b64encode(flow.response.content).decode('ascii')}"
        return None

    def _save_data(self):
        """Save current data to JSON file."""
        # Limit to max_requests (remove oldest if needed)
        if len(self.requests_data) > self.max_requests:
            self.requests_data = self.requests_data[-self.max_requests:]
        
        try:
            # Create directory if it doesn't exist
            self.log_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Write to temp file first, then rename (atomic operation)
            temp_file = self.log_file.with_suffix('.tmp')
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(self.requests_data, f, indent=2, ensure_ascii=False)
            
            temp_file.replace(self.log_file)
            
        except Exception as e:
            print(f"❌ Error saving data: {e}")

    def request(self, flow: http.HTTPFlow):
        """Called when a request is made."""
        if not self._should_monitor_request(flow):
            return

        # Generate request data
        request_id = self._generate_request_id(flow)
        timestamp = datetime.now().isoformat()
        
        # Parse URL components
        parsed_url = urlparse(flow.request.pretty_url)
        all_query_params = self._extract_query_params(flow.request.pretty_url)
        important_params = self._filter_important_params(all_query_params)
        
        # Extract headers (hide sensitive info per user preference)
        headers = dict(flow.request.headers)
        # Hide sensitive billing/card info in headers
        for key in headers:
            if any(sensitive in key.lower() for sensitive in ['card', 'billing', 'payment', 'cvv', 'ccv']):
                headers[key] = "[HIDDEN]"
        
        # Get client IP
        client_ip = flow.client_conn.address[0] if flow.client_conn.address else "unknown"
        
        # Create request data structure
        request_data = {
            "id": request_id,
            "timestamp": timestamp,
            "type": "request",
            "method": flow.request.method,
            "url": flow.request.pretty_url,
            "hostname": flow.request.pretty_host,
            "path": parsed_url.path,
            "queryParams": all_query_params,
            "importantParams": important_params,
            "headers": headers,
            "requestBody": self._get_request_body(flow),
            "clientIp": client_ip,
            "source": "mitmproxy",
            # Response fields (will be filled when response arrives)
            "statusCode": None,
            "responseHeaders": None,
            "responseBody": None,
            "completed": False,
            "completedTimestamp": None
        }
        
        # Store request data
        self.requests_data.append(request_data)
        
        # Store request ID in flow for response matching
        flow.metadata["wildlink_request_id"] = request_id
        
        print(f"📥 Captured request: {flow.request.method} {flow.request.pretty_url}")
        
        # Auto-save after each request
        self._save_data()

    def response(self, flow: http.HTTPFlow):
        """Called when a response is received."""
        if not self._should_monitor_request(flow):
            return
            
        # Find the corresponding request data
        request_id = flow.metadata.get("wildlink_request_id")
        if not request_id:
            return
            
        # Find request in our data
        request_data = None
        for req in reversed(self.requests_data):  # Search from most recent
            if req["id"] == request_id:
                request_data = req
                break
                
        if not request_data:
            return
            
        # Extract response headers (hide sensitive info)
        response_headers = dict(flow.response.headers) if flow.response else {}
        for key in response_headers:
            if any(sensitive in key.lower() for sensitive in ['card', 'billing', 'payment']):
                response_headers[key] = "[HIDDEN]"
        
        # Update request data with response information
        request_data.update({
            "statusCode": flow.response.status_code if flow.response else None,
            "responseHeaders": response_headers,
            "responseBody": self._get_response_body(flow),
            "completed": True,
            "completedTimestamp": datetime.now().isoformat()
        })
        
        print(f"📤 Captured response: {flow.response.status_code if flow.response else 'N/A'} for {flow.request.pretty_url}")
        
        # Auto-save after each response
        self._save_data()

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about captured traffic."""
        total_requests = len(self.requests_data)
        completed_requests = sum(1 for req in self.requests_data if req["completed"])
        
        # Count by domain
        domain_counts = {}
        for req in self.requests_data:
            domain = req["hostname"]
            domain_counts[domain] = domain_counts.get(domain, 0) + 1
            
        # Count by method
        method_counts = {}
        for req in self.requests_data:
            method = req["method"]
            method_counts[method] = method_counts.get(method, 0) + 1
        
        return {
            "total_requests": total_requests,
            "completed_requests": completed_requests,
            "pending_requests": total_requests - completed_requests,
            "domain_breakdown": domain_counts,
            "method_breakdown": method_counts,
            "log_file_size": self.log_file.stat().st_size if self.log_file.exists() else 0
        }


# Global monitor instance
monitor = WildlinkProxyMonitor()

# mitmproxy addon functions
def request(flow: http.HTTPFlow):
    """mitmproxy request handler."""
    monitor.request(flow)

def response(flow: http.HTTPFlow):
    """mitmproxy response handler."""
    monitor.response(flow)


if __name__ == "__main__":
    print("🔧 Starting Wildlink Proxy Monitor...")
    print("ℹ️  This script is designed to be run with mitmproxy")
    print("ℹ️  Use: mitmproxy -s proxy_service.py")
    print("ℹ️  Or: mitmdump -s proxy_service.py")
