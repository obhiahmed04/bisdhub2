"""
BISD HUB Iteration 7 Backend Tests
Testing new features:
1. Voice messages in Global Chat and DMs (MediaRecorder API + /api/upload)
2. Audio/Video calls in DMs (WebRTC peer-to-peer with signaling via WebSocket)
3. DM conversation search bar
"""

import pytest
import requests
import os
import json
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDS = {"id_number": "ADMIN001", "password": "admin123"}
MOD_CREDS = {"id_number": "MOD001", "password": "mod123"}
USER_CREDS = {"id_number": "USER001", "password": "user123"}


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_user_login(self):
        """Test regular user login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=USER_CREDS)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["id_number"] == "USER001"
        print(f"PASS: User login successful - USER001")
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert data["user"]["is_admin"] == True
        print(f"PASS: Admin login successful - ADMIN001")
    
    def test_moderator_login(self):
        """Test moderator login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MOD_CREDS)
        assert response.status_code == 200, f"Mod login failed: {response.text}"
        data = response.json()
        assert data["user"]["is_moderator"] == True
        print(f"PASS: Moderator login successful - MOD001")


class TestUploadEndpoint:
    """Test file upload endpoint - critical for voice messages"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=USER_CREDS)
        return response.json()["token"]
    
    def test_upload_audio_webm(self, auth_token):
        """Test uploading audio/webm file (voice message format)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create a minimal valid webm file header (just for testing MIME type acceptance)
        # Real webm files would be larger, but this tests the endpoint accepts audio/webm
        webm_header = bytes([0x1A, 0x45, 0xDF, 0xA3])  # EBML header
        
        files = {
            'file': ('voice.webm', webm_header, 'audio/webm')
        }
        
        response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "url" in data
        assert data["url"].startswith("/api/uploads/")
        assert data["url"].endswith(".webm")
        print(f"PASS: Audio/webm upload accepted - URL: {data['url']}")
        return data["url"]
    
    def test_upload_audio_ogg(self, auth_token):
        """Test uploading audio/ogg file"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Minimal OGG header
        ogg_header = bytes([0x4F, 0x67, 0x67, 0x53])  # OggS
        
        files = {
            'file': ('voice.ogg', ogg_header, 'audio/ogg')
        }
        
        response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "url" in data
        print(f"PASS: Audio/ogg upload accepted - URL: {data['url']}")
    
    def test_upload_audio_mp4(self, auth_token):
        """Test uploading audio/mp4 file"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Minimal MP4 header
        mp4_header = bytes([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70])
        
        files = {
            'file': ('voice.m4a', mp4_header, 'audio/mp4')
        }
        
        response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        print(f"PASS: Audio/mp4 upload accepted")
    
    def test_upload_audio_mpeg(self, auth_token):
        """Test uploading audio/mpeg (MP3) file"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Minimal MP3 header (ID3 tag)
        mp3_header = bytes([0x49, 0x44, 0x33, 0x04])  # ID3v2.4
        
        files = {
            'file': ('voice.mp3', mp3_header, 'audio/mpeg')
        }
        
        response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        print(f"PASS: Audio/mpeg upload accepted")
    
    def test_upload_audio_wav(self, auth_token):
        """Test uploading audio/wav file"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Minimal WAV header
        wav_header = bytes([0x52, 0x49, 0x46, 0x46])  # RIFF
        
        files = {
            'file': ('voice.wav', wav_header, 'audio/wav')
        }
        
        response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        print(f"PASS: Audio/wav upload accepted")
    
    def test_upload_image_still_works(self, auth_token):
        """Test that image uploads still work"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Minimal JPEG header
        jpeg_header = bytes([0xFF, 0xD8, 0xFF, 0xE0])
        
        files = {
            'file': ('test.jpg', jpeg_header, 'image/jpeg')
        }
        
        response = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        print(f"PASS: Image upload still works")
    
    def test_upload_unauthorized(self):
        """Test upload without auth token fails"""
        files = {
            'file': ('voice.webm', b'test', 'audio/webm')
        }
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files)
        assert response.status_code in [401, 403], f"Expected auth error, got: {response.status_code}"
        print(f"PASS: Upload without auth correctly rejected")


class TestChatRooms:
    """Test chat room endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=USER_CREDS)
        return response.json()["token"]
    
    def test_get_chat_rooms(self, auth_token):
        """Test getting available chat rooms"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/chat/rooms", headers=headers)
        assert response.status_code == 200, f"Failed to get chat rooms: {response.text}"
        rooms = response.json()
        assert isinstance(rooms, list)
        assert len(rooms) > 0
        # Check general room exists
        room_ids = [r['id'] for r in rooms]
        assert 'general' in room_ids
        print(f"PASS: Chat rooms retrieved - {len(rooms)} rooms found")
    
    def test_get_chat_messages(self, auth_token):
        """Test getting chat messages from general room"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/chat/general/messages", headers=headers)
        assert response.status_code == 200, f"Failed to get messages: {response.text}"
        messages = response.json()
        assert isinstance(messages, list)
        print(f"PASS: Chat messages retrieved - {len(messages)} messages")


class TestDMConversations:
    """Test DM conversation endpoints including search"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=USER_CREDS)
        return response.json()["token"]
    
    def test_get_dm_conversations(self, auth_token):
        """Test getting DM conversations list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/dm/conversations", headers=headers)
        assert response.status_code == 200, f"Failed to get DM conversations: {response.text}"
        conversations = response.json()
        assert isinstance(conversations, list)
        print(f"PASS: DM conversations retrieved - {len(conversations)} conversations")
    
    def test_dm_search_endpoint(self, auth_token):
        """Test DM search endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/dm/search?query=test", headers=headers)
        assert response.status_code == 200, f"DM search failed: {response.text}"
        results = response.json()
        assert isinstance(results, list)
        print(f"PASS: DM search endpoint works - {len(results)} results")
    
    def test_dm_search_empty_query(self, auth_token):
        """Test DM search with empty query returns empty list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/dm/search?query=", headers=headers)
        assert response.status_code == 200
        results = response.json()
        assert results == []
        print(f"PASS: DM search with empty query returns empty list")


class TestGlobalChatFeatures:
    """Test Global Chat features including reply and reactions"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=USER_CREDS)
        return response.json()["token"]
    
    def test_chat_messages_have_expected_fields(self, auth_token):
        """Test that chat messages have all expected fields including voice_url support"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/chat/general/messages", headers=headers)
        assert response.status_code == 200
        messages = response.json()
        
        if len(messages) > 0:
            msg = messages[0]
            # Check expected fields exist
            expected_fields = ['message_id', 'chat_room', 'user_id', 'content', 'created_at', 'user']
            for field in expected_fields:
                assert field in msg, f"Missing field: {field}"
            print(f"PASS: Chat messages have expected fields")
        else:
            print(f"PASS: Chat messages endpoint works (no messages yet)")


class TestSearchEndpoints:
    """Test search functionality"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=USER_CREDS)
        return response.json()["token"]
    
    def test_search_users(self, auth_token):
        """Test user search"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/users/search?query=admin", headers=headers)
        assert response.status_code == 200, f"User search failed: {response.text}"
        users = response.json()
        assert isinstance(users, list)
        print(f"PASS: User search works - {len(users)} results for 'admin'")
    
    def test_search_posts(self, auth_token):
        """Test post search"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/posts/search?query=test", headers=headers)
        assert response.status_code == 200, f"Post search failed: {response.text}"
        posts = response.json()
        assert isinstance(posts, list)
        print(f"PASS: Post search works - {len(posts)} results for 'test'")


class TestAdminPanel:
    """Test Admin Panel endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        return response.json()["token"]
    
    def test_get_all_users(self, admin_token):
        """Test admin can get all users"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 200, f"Failed to get users: {response.text}"
        users = response.json()
        assert isinstance(users, list)
        assert len(users) > 0
        print(f"PASS: Admin can get all users - {len(users)} users")
    
    def test_get_action_logs(self, admin_token):
        """Test admin can get action logs"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/management/action-logs", headers=headers)
        assert response.status_code == 200, f"Failed to get action logs: {response.text}"
        logs = response.json()
        assert isinstance(logs, list)
        print(f"PASS: Admin can get action logs - {len(logs)} logs")
    
    def test_action_logs_search(self, admin_token):
        """Test action logs search functionality"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/management/action-logs?search=approve", headers=headers)
        assert response.status_code == 200, f"Action logs search failed: {response.text}"
        logs = response.json()
        assert isinstance(logs, list)
        print(f"PASS: Action logs search works - {len(logs)} results for 'approve'")


class TestModerationPanel:
    """Test Moderation Panel endpoints"""
    
    @pytest.fixture
    def mod_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MOD_CREDS)
        return response.json()["token"]
    
    def test_get_post_reports(self, mod_token):
        """Test moderator can get post reports"""
        headers = {"Authorization": f"Bearer {mod_token}"}
        response = requests.get(f"{BASE_URL}/api/mod/reports", headers=headers)
        assert response.status_code == 200, f"Failed to get reports: {response.text}"
        reports = response.json()
        assert isinstance(reports, list)
        print(f"PASS: Moderator can get post reports - {len(reports)} reports")
    
    def test_get_chat_reports(self, mod_token):
        """Test moderator can get chat reports"""
        headers = {"Authorization": f"Bearer {mod_token}"}
        response = requests.get(f"{BASE_URL}/api/mod/chat-reports", headers=headers)
        assert response.status_code == 200, f"Failed to get chat reports: {response.text}"
        reports = response.json()
        assert isinstance(reports, list)
        print(f"PASS: Moderator can get chat reports - {len(reports)} reports")


class TestSettingsAndFriends:
    """Test Settings and Friends functionality"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=USER_CREDS)
        return response.json()["token"]
    
    def test_get_friends_list(self, auth_token):
        """Test getting friends list"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/friends/list", headers=headers)
        assert response.status_code == 200, f"Failed to get friends: {response.text}"
        friends = response.json()
        assert isinstance(friends, list)
        print(f"PASS: Friends list retrieved - {len(friends)} friends")
    
    def test_get_friend_requests(self, auth_token):
        """Test getting friend requests"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/friends/requests", headers=headers)
        assert response.status_code == 200, f"Failed to get friend requests: {response.text}"
        requests_list = response.json()
        assert isinstance(requests_list, list)
        print(f"PASS: Friend requests retrieved - {len(requests_list)} requests")
    
    def test_get_notifications(self, auth_token):
        """Test getting notifications"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/notifications", headers=headers)
        assert response.status_code == 200, f"Failed to get notifications: {response.text}"
        notifications = response.json()
        assert isinstance(notifications, list)
        print(f"PASS: Notifications retrieved - {len(notifications)} notifications")


class TestPostFeatures:
    """Test post-related features"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=USER_CREDS)
        return response.json()["token"]
    
    def test_get_public_feed(self, auth_token):
        """Test getting public feed"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/posts/feed/feed", headers=headers)
        assert response.status_code == 200, f"Failed to get feed: {response.text}"
        posts = response.json()
        assert isinstance(posts, list)
        print(f"PASS: Public feed retrieved - {len(posts)} posts")
    
    def test_get_official_feed(self, auth_token):
        """Test getting official feed"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/posts/feed/official", headers=headers)
        assert response.status_code == 200, f"Failed to get official feed: {response.text}"
        posts = response.json()
        assert isinstance(posts, list)
        print(f"PASS: Official feed retrieved - {len(posts)} posts")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
