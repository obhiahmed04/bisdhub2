"""
BISD HUB Iteration 6 Backend Tests
Testing bug fixes: logo sizing, serial number removal, notification bell, search enhancement, 
enriched report details, and new Chat Reports tab in ModerationPanel.

New endpoints tested:
- GET /mod/chat-reports - enriched chat reports with violator and message data
- PUT /mod/chat-reports/{id}/resolve - resolve chat reports
- GET /mod/reports - enriched post reports with violator data
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"id_number": "ADMIN001", "password": "admin123"}
MOD_CREDS = {"id_number": "MOD001", "password": "mod123"}
USER_CREDS = {"id_number": "USER001", "password": "user123"}


class TestAuthentication:
    """Test login functionality"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["is_admin"] == True
        print("✓ Admin login successful")
    
    def test_moderator_login(self):
        """Test moderator login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MOD_CREDS)
        assert response.status_code == 200, f"Moderator login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["is_moderator"] == True
        print("✓ Moderator login successful")
    
    def test_user_login(self):
        """Test regular user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=USER_CREDS)
        assert response.status_code == 200, f"User login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print("✓ Regular user login successful")


class TestModerationEndpoints:
    """Test moderation panel endpoints - enriched reports"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get moderator token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MOD_CREDS)
        if response.status_code == 200:
            self.mod_token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.mod_token}"}
        else:
            pytest.skip("Moderator login failed")
    
    def test_get_post_reports_enriched(self):
        """Test GET /mod/reports returns enriched data with violator info"""
        response = requests.get(f"{BASE_URL}/api/mod/reports", headers=self.headers, params={"status": "pending"})
        assert response.status_code == 200, f"Failed to get reports: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /mod/reports returned {len(data)} reports")
        
        # If there are reports, check for enriched data
        if len(data) > 0:
            report = data[0]
            assert "serial_number" in report, "Report missing serial_number"
            assert "reporter" in report, "Report missing reporter info"
            # Check for violator info (post author)
            if report.get("post"):
                assert "violator" in report or report.get("post", {}).get("user_id"), "Report should have violator info"
            print(f"✓ Report has enriched data: serial_number={report.get('serial_number')}")
    
    def test_get_chat_reports_endpoint(self):
        """Test GET /mod/chat-reports endpoint exists and returns data"""
        response = requests.get(f"{BASE_URL}/api/mod/chat-reports", headers=self.headers, params={"status": "pending"})
        assert response.status_code == 200, f"Failed to get chat reports: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /mod/chat-reports returned {len(data)} chat reports")
        
        # If there are chat reports, check for enriched data
        if len(data) > 0:
            report = data[0]
            assert "serial_number" in report, "Chat report missing serial_number"
            assert "reporter" in report, "Chat report missing reporter info"
            # Check for message and violator info
            if report.get("message"):
                print(f"✓ Chat report has message content: {report['message'].get('content', '')[:50]}...")
            if report.get("violator"):
                print(f"✓ Chat report has violator info: {report['violator'].get('display_name')}")
    
    def test_resolve_chat_report_endpoint(self):
        """Test PUT /mod/chat-reports/{id}/resolve endpoint exists"""
        # First get chat reports
        response = requests.get(f"{BASE_URL}/api/mod/chat-reports", headers=self.headers, params={"status": "pending"})
        if response.status_code == 200 and len(response.json()) > 0:
            report_id = response.json()[0]["report_id"]
            # Try to resolve it
            resolve_response = requests.put(
                f"{BASE_URL}/api/mod/chat-reports/{report_id}/resolve",
                headers=self.headers,
                params={"status": "reviewed"}
            )
            assert resolve_response.status_code == 200, f"Failed to resolve chat report: {resolve_response.text}"
            print(f"✓ PUT /mod/chat-reports/{report_id}/resolve works")
        else:
            # Test with a fake ID to verify endpoint exists
            resolve_response = requests.put(
                f"{BASE_URL}/api/mod/chat-reports/fake-id/resolve",
                headers=self.headers,
                params={"status": "reviewed"}
            )
            # Should return 200 (no error even if not found) or 404
            assert resolve_response.status_code in [200, 404], f"Unexpected status: {resolve_response.status_code}"
            print("✓ PUT /mod/chat-reports/{id}/resolve endpoint exists")


class TestSearchEndpoints:
    """Test search functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=USER_CREDS)
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("User login failed")
    
    def test_search_users(self):
        """Test user search endpoint"""
        response = requests.get(f"{BASE_URL}/api/users/search", headers=self.headers, params={"query": "admin"})
        assert response.status_code == 200, f"User search failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ User search returned {len(data)} results")
    
    def test_search_posts(self):
        """Test post search endpoint"""
        response = requests.get(f"{BASE_URL}/api/posts/search", headers=self.headers, params={"query": "test"})
        assert response.status_code == 200, f"Post search failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Post search returned {len(data)} results")


class TestChatReportFlow:
    """Test chat message reporting flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=USER_CREDS)
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("User login failed")
    
    def test_chat_report_endpoint(self):
        """Test POST /chat/report endpoint"""
        # This endpoint is used by the frontend to report chat messages
        report_data = {
            "message_id": "test-message-id",
            "chat_room": "general",
            "reason": "Test report reason",
            "category": "other"
        }
        response = requests.post(f"{BASE_URL}/api/chat/report", headers=self.headers, json=report_data)
        # Should return 200 or 404 (if message not found)
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            assert "serial_number" in data, "Report response should include serial_number"
            print(f"✓ Chat report created with serial_number: {data.get('serial_number')}")
        else:
            print("✓ Chat report endpoint exists (message not found is expected)")


class TestAdminEndpoints:
    """Test admin panel endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if response.status_code == 200:
            self.admin_token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.admin_token}"}
        else:
            pytest.skip("Admin login failed")
    
    def test_get_all_users(self):
        """Test GET /admin/users endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=self.headers)
        assert response.status_code == 200, f"Failed to get users: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should have at least one user"
        print(f"✓ GET /admin/users returned {len(data)} users")
    
    def test_action_logs_with_search(self):
        """Test GET /management/action-logs with search parameter"""
        # Test without search
        response = requests.get(f"{BASE_URL}/api/management/action-logs", headers=self.headers, params={"limit": 50})
        assert response.status_code == 200, f"Failed to get action logs: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /management/action-logs returned {len(data)} logs")
        
        # Test with search parameter
        response_search = requests.get(f"{BASE_URL}/api/management/action-logs", headers=self.headers, params={"search": "1", "limit": 50})
        assert response_search.status_code == 200, f"Failed to search action logs: {response_search.text}"
        print(f"✓ Action logs search works, returned {len(response_search.json())} results")


class TestFriendsEndpoints:
    """Test friends functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=USER_CREDS)
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("User login failed")
    
    def test_friends_list(self):
        """Test GET /friends/list endpoint"""
        response = requests.get(f"{BASE_URL}/api/friends/list", headers=self.headers)
        assert response.status_code == 200, f"Failed to get friends list: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /friends/list returned {len(data)} friends")
    
    def test_friend_requests(self):
        """Test GET /friends/requests endpoint"""
        response = requests.get(f"{BASE_URL}/api/friends/requests", headers=self.headers)
        assert response.status_code == 200, f"Failed to get friend requests: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /friends/requests returned {len(data)} requests")


class TestNotifications:
    """Test notification endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=USER_CREDS)
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("User login failed")
    
    def test_get_notifications(self):
        """Test GET /notifications endpoint"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=self.headers, params={"limit": 20})
        assert response.status_code == 200, f"Failed to get notifications: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /notifications returned {len(data)} notifications")


class TestChatRooms:
    """Test chat room endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=USER_CREDS)
        if response.status_code == 200:
            self.token = response.json()["token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("User login failed")
    
    def test_get_chat_rooms(self):
        """Test GET /chat/rooms endpoint"""
        response = requests.get(f"{BASE_URL}/api/chat/rooms", headers=self.headers)
        assert response.status_code == 200, f"Failed to get chat rooms: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should have at least one chat room"
        # Check that general room exists
        room_ids = [r["id"] for r in data]
        assert "general" in room_ids, "General room should exist"
        print(f"✓ GET /chat/rooms returned {len(data)} rooms: {room_ids}")
    
    def test_get_chat_messages(self):
        """Test GET /chat/{room}/messages endpoint"""
        response = requests.get(f"{BASE_URL}/api/chat/general/messages", headers=self.headers)
        assert response.status_code == 200, f"Failed to get chat messages: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /chat/general/messages returned {len(data)} messages")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
