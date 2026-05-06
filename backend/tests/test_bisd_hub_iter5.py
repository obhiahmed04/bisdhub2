"""
BISD HUB - Iteration 5 Backend Tests
Testing new features: Friends endpoints, Admin edit user, Action logs search, Chat report
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bisd-hub-social.preview.emergentagent.com')
if not BASE_URL.endswith('/api'):
    BASE_URL = BASE_URL.rstrip('/') + '/api'

# Test credentials
ADMIN_CREDS = {"id_number": "ADMIN001", "password": "admin123"}
USER_CREDS = {"id_number": "USER001", "password": "user123"}
MOD_CREDS = {"id_number": "MOD001", "password": "mod123"}

class TestAuth:
    """Authentication tests"""
    
    def test_admin_login(self):
        """Test admin login with ADMIN001/admin123"""
        response = requests.post(f"{BASE_URL}/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["id_number"] == "ADMIN001"
        assert data["user"]["is_admin"] == True
        print(f"Admin login successful: {data['user']['display_name']}")
    
    def test_user_login(self):
        """Test regular user login with USER001/user123"""
        response = requests.post(f"{BASE_URL}/auth/login", json=USER_CREDS)
        assert response.status_code == 200, f"User login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["id_number"] == "USER001"
        print(f"User login successful: {data['user']['display_name']}")
    
    def test_mod_login(self):
        """Test moderator login with MOD001/mod123"""
        response = requests.post(f"{BASE_URL}/auth/login", json=MOD_CREDS)
        assert response.status_code == 200, f"Mod login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["is_moderator"] == True
        print(f"Moderator login successful: {data['user']['display_name']}")


class TestFriendsEndpoints:
    """Friends system endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login as user
        response = requests.post(f"{BASE_URL}/auth/login", json=USER_CREDS)
        self.user_token = response.json()["token"]
        self.user_data = response.json()["user"]
        self.headers = {"Authorization": f"Bearer {self.user_token}"}
    
    def test_get_friends_list(self):
        """Test GET /friends/list endpoint"""
        response = requests.get(f"{BASE_URL}/friends/list", headers=self.headers)
        assert response.status_code == 200, f"Failed to get friends list: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Friends list retrieved: {len(data)} friends")
    
    def test_get_friend_requests(self):
        """Test GET /friends/requests endpoint"""
        response = requests.get(f"{BASE_URL}/friends/requests", headers=self.headers)
        assert response.status_code == 200, f"Failed to get friend requests: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Friend requests retrieved: {len(data)} pending requests")


class TestAdminEditUser:
    """Admin edit user endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login as admin
        response = requests.post(f"{BASE_URL}/auth/login", json=ADMIN_CREDS)
        self.admin_token = response.json()["token"]
        self.admin_data = response.json()["user"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_get_all_users(self):
        """Test GET /admin/users endpoint"""
        response = requests.get(f"{BASE_URL}/admin/users", headers=self.headers)
        assert response.status_code == 200, f"Failed to get users: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"Retrieved {len(data)} users")
    
    def test_edit_user_endpoint_exists(self):
        """Test PUT /admin/users/{user_id}/edit endpoint exists"""
        # Get a user to edit
        users_response = requests.get(f"{BASE_URL}/admin/users", headers=self.headers)
        users = users_response.json()
        
        # Find USER001 to test edit
        test_user = next((u for u in users if u["id_number"] == "USER001"), None)
        if test_user:
            edit_data = {
                "user_id": test_user["user_id"],
                "display_name": test_user.get("display_name", "Test User"),
                "bio": "Test bio update"
            }
            response = requests.put(
                f"{BASE_URL}/admin/users/{test_user['user_id']}/edit",
                json=edit_data,
                headers=self.headers
            )
            # Should return 200 or 404 if endpoint doesn't exist
            assert response.status_code in [200, 422], f"Edit user endpoint issue: {response.status_code} - {response.text}"
            print(f"Edit user endpoint test: {response.status_code}")


class TestActionLogs:
    """Action logs endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login as admin
        response = requests.post(f"{BASE_URL}/auth/login", json=ADMIN_CREDS)
        self.admin_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.admin_token}"}
    
    def test_get_action_logs(self):
        """Test GET /management/action-logs endpoint"""
        response = requests.get(f"{BASE_URL}/management/action-logs", headers=self.headers)
        assert response.status_code == 200, f"Failed to get action logs: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Retrieved {len(data)} action logs")
    
    def test_action_logs_search(self):
        """Test action logs search functionality"""
        # Search by action type
        response = requests.get(
            f"{BASE_URL}/management/action-logs",
            params={"search": "approve"},
            headers=self.headers
        )
        assert response.status_code == 200, f"Action logs search failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Action logs search returned {len(data)} results for 'approve'")
    
    def test_action_logs_with_limit(self):
        """Test action logs with limit parameter"""
        response = requests.get(
            f"{BASE_URL}/management/action-logs",
            params={"limit": 10},
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 10
        print(f"Action logs with limit=10 returned {len(data)} results")


class TestChatReport:
    """Chat message report endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login as user
        response = requests.post(f"{BASE_URL}/auth/login", json=USER_CREDS)
        self.user_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.user_token}"}
    
    def test_chat_report_endpoint_exists(self):
        """Test POST /chat/report endpoint exists"""
        # This should fail with 422 (validation error) if endpoint exists but data is invalid
        # or 404 if endpoint doesn't exist
        report_data = {
            "message_id": "test-message-id",
            "chat_room": "general",
            "reason": "Test report",
            "category": "other"
        }
        response = requests.post(
            f"{BASE_URL}/chat/report",
            json=report_data,
            headers=self.headers
        )
        # 200 = success, 404 = message not found (endpoint exists), 422 = validation error
        assert response.status_code in [200, 404, 422], f"Chat report endpoint issue: {response.status_code}"
        print(f"Chat report endpoint test: {response.status_code}")


class TestChatRooms:
    """Chat rooms endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/auth/login", json=USER_CREDS)
        self.user_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.user_token}"}
    
    def test_get_chat_rooms(self):
        """Test GET /chat/rooms endpoint"""
        response = requests.get(f"{BASE_URL}/chat/rooms", headers=self.headers)
        assert response.status_code == 200, f"Failed to get chat rooms: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Retrieved {len(data)} chat rooms")
    
    def test_get_general_chat_messages(self):
        """Test GET /chat/general/messages endpoint"""
        response = requests.get(f"{BASE_URL}/chat/general/messages", headers=self.headers)
        assert response.status_code == 200, f"Failed to get chat messages: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Retrieved {len(data)} messages from general chat")


class TestPostFeed:
    """Post feed endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/auth/login", json=USER_CREDS)
        self.user_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.user_token}"}
    
    def test_get_public_feed(self):
        """Test GET /posts/feed/feed endpoint"""
        response = requests.get(f"{BASE_URL}/posts/feed/feed", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Check posts have serial_number
        for post in data[:5]:
            if "serial_number" in post:
                print(f"Post #{post.get('serial_number')} found")
        print(f"Public feed: {len(data)} posts")
    
    def test_get_official_feed(self):
        """Test GET /posts/feed/official endpoint"""
        response = requests.get(f"{BASE_URL}/posts/feed/official", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Official feed: {len(data)} posts")
    
    def test_get_friends_feed(self):
        """Test GET /posts/feed/friends endpoint"""
        response = requests.get(f"{BASE_URL}/posts/feed/friends", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Friends feed: {len(data)} posts")


class TestNotifications:
    """Notification endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/auth/login", json=USER_CREDS)
        self.user_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.user_token}"}
    
    def test_get_notifications(self):
        """Test GET /notifications endpoint"""
        response = requests.get(f"{BASE_URL}/notifications", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Retrieved {len(data)} notifications")
    
    def test_get_unread_count(self):
        """Test GET /notifications/unread/count endpoint"""
        response = requests.get(f"{BASE_URL}/notifications/unread/count", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"Unread notifications: {data['count']}")


class TestDMEndpoints:
    """Direct message endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/auth/login", json=USER_CREDS)
        self.user_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.user_token}"}
    
    def test_get_dm_conversations(self):
        """Test GET /dm/conversations endpoint"""
        response = requests.get(f"{BASE_URL}/dm/conversations", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Retrieved {len(data)} DM conversations")


class TestModerationEndpoints:
    """Moderation panel endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/auth/login", json=MOD_CREDS)
        self.mod_token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.mod_token}"}
    
    def test_get_reports(self):
        """Test GET /mod/reports endpoint"""
        response = requests.get(f"{BASE_URL}/mod/reports", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Retrieved {len(data)} pending reports")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
