"""
BISD HUB Backend API Tests
Tests for: Authentication, Posts, Feed, Chat, DM, Admin, Moderation, Management, Profile, Friends
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_CREDS = {"id_number": "ADMIN001", "password": "admin123"}
MOD_CREDS = {"id_number": "MOD001", "password": "mod123"}
MGMT_CREDS = {"id_number": "MGMT001", "password": "management123"}
USER_CREDS = {"id_number": "USER001", "password": "user123"}

class TestAPIRoot:
    """Test API root endpoint"""
    
    def test_api_root(self):
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "BISD HUB API"
        print("✓ API root endpoint working")


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_admin_login_success(self):
        """Test admin login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["id_number"] == "ADMIN001"
        assert data["user"]["is_admin"] == True
        print(f"✓ Admin login successful - user: {data['user']['display_name']}")
    
    def test_moderator_login_success(self):
        """Test moderator login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MOD_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["is_moderator"] == True
        print(f"✓ Moderator login successful - user: {data['user']['display_name']}")
    
    def test_management_login_success(self):
        """Test management login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MGMT_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] in ["Project Owner", "Management"]
        print(f"✓ Management login successful - role: {data['user']['role']}")
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "id_number": "ADMIN001",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials rejected correctly")
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "id_number": "NONEXISTENT",
            "password": "test123"
        })
        assert response.status_code == 401
        print("✓ Non-existent user rejected correctly")


class TestUserProfile:
    """Test user profile endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    def test_get_my_profile(self, admin_token):
        """Test getting current user profile"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "display_name" in data
        assert "id_number" in data
        assert data["id_number"] == "ADMIN001"
        print(f"✓ Get my profile - display_name: {data['display_name']}")
    
    def test_update_profile(self, admin_token):
        """Test updating user profile"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        update_data = {"bio": f"Test bio updated at {time.time()}"}
        response = requests.put(f"{BASE_URL}/api/users/me", headers=headers, json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert "bio" in data
        print(f"✓ Profile updated successfully")
    
    def test_get_user_by_id_number(self, admin_token):
        """Test getting user profile by ID number"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users/ADMIN001", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id_number"] == "ADMIN001"
        print(f"✓ Get user by ID - found: {data['display_name']}")
    
    def test_search_users(self, admin_token):
        """Test user search"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users/search?query=ADMIN", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ User search returned {len(data)} results")


class TestPosts:
    """Test post endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    def test_create_public_post(self, admin_token):
        """Test creating a public post"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        post_data = {
            "content": f"Test public post at {time.time()}",
            "visibility": "public",
            "images": []
        }
        response = requests.post(f"{BASE_URL}/api/posts", headers=headers, json=post_data)
        assert response.status_code == 200
        data = response.json()
        assert "post_id" in data
        assert data["visibility"] == "public"
        print(f"✓ Public post created - post_id: {data['post_id']}")
        return data["post_id"]
    
    def test_create_official_post(self, admin_token):
        """Test creating an official post (admin only)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        post_data = {
            "content": f"Official announcement at {time.time()}",
            "visibility": "official",
            "images": []
        }
        response = requests.post(f"{BASE_URL}/api/posts", headers=headers, json=post_data)
        assert response.status_code == 200
        data = response.json()
        assert data["visibility"] == "official"
        assert data["is_official"] == True
        print(f"✓ Official post created - is_official: {data['is_official']}")
    
    def test_get_public_feed(self, admin_token):
        """Test getting public feed"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/posts/feed/feed", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Public feed returned {len(data)} posts")
    
    def test_get_official_feed(self, admin_token):
        """Test getting official feed"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/posts/feed/official", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Official feed returned {len(data)} posts")
    
    def test_get_following_feed(self, admin_token):
        """Test getting following feed"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/posts/feed/following", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Following feed returned {len(data)} posts")
    
    def test_get_friends_feed(self, admin_token):
        """Test getting friends feed"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/posts/feed/friends", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Friends feed returned {len(data)} posts")
    
    def test_like_unlike_post(self, admin_token):
        """Test liking and unliking a post"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # First create a post
        post_data = {"content": "Test post for like", "visibility": "public", "images": []}
        create_resp = requests.post(f"{BASE_URL}/api/posts", headers=headers, json=post_data)
        post_id = create_resp.json()["post_id"]
        
        # Like the post
        like_resp = requests.post(f"{BASE_URL}/api/posts/{post_id}/like", headers=headers)
        assert like_resp.status_code == 200
        print(f"✓ Post liked successfully")
        
        # Unlike the post
        unlike_resp = requests.delete(f"{BASE_URL}/api/posts/{post_id}/like", headers=headers)
        assert unlike_resp.status_code == 200
        print(f"✓ Post unliked successfully")
    
    def test_add_comment(self, admin_token):
        """Test adding a comment to a post"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # First create a post
        post_data = {"content": "Test post for comment", "visibility": "public", "images": []}
        create_resp = requests.post(f"{BASE_URL}/api/posts", headers=headers, json=post_data)
        post_id = create_resp.json()["post_id"]
        
        # Add comment
        comment_data = {"content": "Test comment"}
        comment_resp = requests.post(f"{BASE_URL}/api/posts/{post_id}/comment", headers=headers, json=comment_data)
        assert comment_resp.status_code == 200
        data = comment_resp.json()
        assert data["status"] == "success"
        print(f"✓ Comment added successfully")
    
    def test_search_posts(self, admin_token):
        """Test post search"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/posts/search?query=test", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Post search returned {len(data)} results")


class TestGlobalChat:
    """Test global chat endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    def test_get_general_chat_messages(self, admin_token):
        """Test getting general chat messages"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/chat/general/messages", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ General chat returned {len(data)} messages")


class TestDirectMessages:
    """Test DM endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    @pytest.fixture
    def admin_user_id(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["user"]["user_id"]
    
    def test_get_dm_conversations(self, admin_token):
        """Test getting DM conversations"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/dm/conversations", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ DM conversations returned {len(data)} conversations")
    
    def test_send_dm(self, admin_token):
        """Test sending a DM"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Get mod user_id first
        mod_resp = requests.post(f"{BASE_URL}/api/auth/login", json=MOD_CREDS)
        mod_user_id = mod_resp.json()["user"]["user_id"]
        
        # Send DM
        dm_data = {"content": f"Test DM at {time.time()}"}
        response = requests.post(f"{BASE_URL}/api/dm/{mod_user_id}/send", headers=headers, json=dm_data)
        assert response.status_code == 200
        data = response.json()
        assert "dm_id" in data
        print(f"✓ DM sent successfully - dm_id: {data['dm_id']}")


class TestAdminPanel:
    """Test admin panel endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    def test_get_pending_registrations(self, admin_token):
        """Test getting pending registrations"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/registrations/pending", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Pending registrations: {len(data)}")
    
    def test_get_all_users(self, admin_token):
        """Test getting all users"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ All users returned: {len(data)} users")
    
    def test_get_help_chats(self, admin_token):
        """Test getting help chats"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/help-chats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Help chats returned: {len(data)}")


class TestModerationPanel:
    """Test moderation panel endpoints"""
    
    @pytest.fixture
    def mod_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MOD_CREDS)
        return response.json()["token"]
    
    def test_get_reports(self, mod_token):
        """Test getting reports"""
        headers = {"Authorization": f"Bearer {mod_token}"}
        response = requests.get(f"{BASE_URL}/api/mod/reports", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Reports returned: {len(data)}")


class TestManagementPanel:
    """Test management panel endpoints"""
    
    @pytest.fixture
    def mgmt_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MGMT_CREDS)
        return response.json()["token"]
    
    def test_get_all_users_with_passwords(self, mgmt_token):
        """Test getting all users with passwords (management only)"""
        headers = {"Authorization": f"Bearer {mgmt_token}"}
        response = requests.get(f"{BASE_URL}/api/management/all-users-with-passwords", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify password_hash is included
        assert "password_hash" in data[0]
        print(f"✓ Management users returned: {len(data)} users with password hashes")
    
    def test_get_action_logs(self, mgmt_token):
        """Test getting action logs"""
        headers = {"Authorization": f"Bearer {mgmt_token}"}
        response = requests.get(f"{BASE_URL}/api/management/action-logs", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Action logs returned: {len(data)}")


class TestFriendSystem:
    """Test friend system endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    def test_get_friend_requests(self, admin_token):
        """Test getting friend requests"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/friends/requests", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Friend requests: {len(data)}")
    
    def test_get_friends_list(self, admin_token):
        """Test getting friends list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/friends/list", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Friends list: {len(data)}")


class TestNotifications:
    """Test notification endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    def test_get_notifications(self, admin_token):
        """Test getting notifications"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Notifications: {len(data)}")
    
    def test_get_unread_count(self, admin_token):
        """Test getting unread notification count"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications/unread/count", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"✓ Unread notifications: {data['count']}")


class TestRegistrationStatus:
    """Test registration status check"""
    
    def test_check_registration_status_not_found(self):
        """Test checking registration status for non-existent ID"""
        response = requests.get(f"{BASE_URL}/api/auth/check-registration/NONEXISTENT123")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "not_found"
        print("✓ Registration status check for non-existent ID works")


class TestFollowSystem:
    """Test follow/unfollow endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    def test_get_followers(self, admin_token):
        """Test getting followers list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users/ADMIN001/followers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Followers: {len(data)}")
    
    def test_get_following(self, admin_token):
        """Test getting following list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users/ADMIN001/following", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Following: {len(data)}")


class TestRepostAndShare:
    """Test repost and share functionality"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    def test_repost_post(self, admin_token):
        """Test reposting a post"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # First create a post to repost
        post_data = {"content": f"Original post for repost test {time.time()}", "visibility": "public", "images": []}
        create_resp = requests.post(f"{BASE_URL}/api/posts", headers=headers, json=post_data)
        assert create_resp.status_code == 200
        post_id = create_resp.json()["post_id"]
        
        # Repost it
        repost_resp = requests.post(f"{BASE_URL}/api/posts/{post_id}/repost", headers=headers)
        assert repost_resp.status_code == 200
        data = repost_resp.json()
        assert data["status"] == "success"
        assert "post_id" in data
        print(f"✓ Repost created - new post_id: {data['post_id']}")


class TestFileUpload:
    """Test file upload functionality"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    def test_upload_image(self, admin_token):
        """Test uploading an image file"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Create a simple test image (1x1 pixel PNG)
        import base64
        # Minimal valid PNG (1x1 transparent pixel)
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        files = {"file": ("test.png", png_data, "image/png")}
        response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert data["url"].startswith("/api/uploads/")
        print(f"✓ Image uploaded - URL: {data['url']}")
        
        # Verify the uploaded file is accessible
        file_url = f"{BASE_URL}{data['url']}"
        get_resp = requests.get(file_url)
        assert get_resp.status_code == 200
        print(f"✓ Uploaded file is accessible")
    
    def test_upload_invalid_type(self, admin_token):
        """Test uploading an invalid file type"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        files = {"file": ("test.txt", b"Hello World", "text/plain")}
        response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        assert response.status_code == 400
        print(f"✓ Invalid file type rejected correctly")


class TestAdminRegistrationApproval:
    """Test admin registration approval/rejection endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    def test_get_pending_registrations(self, admin_token):
        """Test getting pending registrations"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/registrations/pending", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Pending registrations: {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
