import requests
import sys
import json
import time
from datetime import datetime

class BISDHubAPITester:
    def __init__(self, base_url="https://bisd-hub-social.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.user_token = None
        self.test_user_id = None
        self.test_reg_id = None
        self.test_post_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"Response: {response.json()}")
                except:
                    print(f"Response text: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"id_number": "ADMIN001", "password": "admin123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"✅ Admin token obtained")
            return True
        return False

    def test_send_otp(self, email):
        """Test sending OTP"""
        success, response = self.run_test(
            "Send OTP",
            "POST",
            "auth/send-otp",
            200,
            data={"email": email}
        )
        if success and 'dev_otp' in response:
            print(f"✅ Dev OTP received: {response['dev_otp']}")
            return True, response['dev_otp']
        return False, None

    def test_verify_otp(self, email, otp):
        """Test OTP verification"""
        success, response = self.run_test(
            "Verify OTP",
            "POST",
            "auth/verify-otp",
            200,
            data={"email": email, "otp": otp}
        )
        return success

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_email = f"test{timestamp}@example.com"
        
        # First send OTP
        otp_success, otp = self.test_send_otp(test_email)
        if not otp_success:
            return False
        
        # Verify OTP
        if not self.test_verify_otp(test_email, otp):
            return False

        # Register user
        registration_data = {
            "id_number": f"TEST{timestamp}",
            "full_name": f"Test User {timestamp}",
            "date_of_birth": "01/01/2000",
            "current_class": "Grade 10",
            "section": "B1",
            "email": test_email,
            "phone_number": "+1234567890",
            "is_ex_student": False
        }

        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=registration_data
        )
        
        if success and 'reg_id' in response:
            self.test_reg_id = response['reg_id']
            self.test_user_data = registration_data
            print(f"✅ Registration ID: {self.test_reg_id}")
            return True
        return False

    def test_get_pending_registrations(self):
        """Test getting pending registrations (admin only)"""
        if not self.admin_token:
            print("❌ Admin token required")
            return False

        success, response = self.run_test(
            "Get Pending Registrations",
            "GET",
            "admin/registrations/pending",
            200,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        if success:
            print(f"✅ Found {len(response)} pending registrations")
            return True
        return False

    def test_approve_registration(self):
        """Test approving a registration"""
        if not self.admin_token or not self.test_reg_id:
            print("❌ Admin token and registration ID required")
            return False

        success, response = self.run_test(
            "Approve Registration",
            "POST",
            "admin/registrations/action",
            200,
            data={
                "reg_id": self.test_reg_id,
                "action": "approve",
                "password": "testpass123"
            },
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        if success:
            print(f"✅ Registration approved")
            return True
        return False

    def test_user_login(self):
        """Test user login after approval"""
        if not hasattr(self, 'test_user_data'):
            print("❌ Test user data required")
            return False

        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={
                "id_number": self.test_user_data['id_number'],
                "password": "testpass123"
            }
        )
        
        if success and 'token' in response:
            self.user_token = response['token']
            self.test_user_id = response['user']['user_id']
            print(f"✅ User token obtained")
            return True
        return False

    def test_create_post(self):
        """Test creating a post"""
        if not self.user_token:
            print("❌ User token required")
            return False

        success, response = self.run_test(
            "Create Post",
            "POST",
            "posts",
            200,
            data={
                "content": "This is a test post from API testing!",
                "images": []
            },
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        if success and 'post_id' in response:
            self.test_post_id = response['post_id']
            print(f"✅ Post created with ID: {self.test_post_id}")
            return True
        return False

    def test_get_feed(self, feed_type="feed"):
        """Test getting feed"""
        if not self.user_token:
            print("❌ User token required")
            return False

        success, response = self.run_test(
            f"Get {feed_type.title()} Feed",
            "GET",
            f"posts/feed/{feed_type}",
            200,
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        if success:
            print(f"✅ Retrieved {len(response)} posts from {feed_type} feed")
            return True
        return False

    def test_like_post(self):
        """Test liking a post"""
        if not self.user_token or not self.test_post_id:
            print("❌ User token and post ID required")
            return False

        success, response = self.run_test(
            "Like Post",
            "POST",
            f"posts/{self.test_post_id}/like",
            200,
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        return success

    def test_unlike_post(self):
        """Test unliking a post"""
        if not self.user_token or not self.test_post_id:
            print("❌ User token and post ID required")
            return False

        success, response = self.run_test(
            "Unlike Post",
            "DELETE",
            f"posts/{self.test_post_id}/like",
            200,
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        return success

    def test_search_users(self):
        """Test searching users"""
        if not self.user_token:
            print("❌ User token required")
            return False

        success, response = self.run_test(
            "Search Users",
            "GET",
            "users/search?query=Test",
            200,
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        if success:
            print(f"✅ Found {len(response)} users in search")
            return True
        return False

    def test_search_posts(self):
        """Test searching posts"""
        if not self.user_token:
            print("❌ User token required")
            return False

        success, response = self.run_test(
            "Search Posts",
            "GET",
            "posts/search?query=test",
            200,
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        if success:
            print(f"✅ Found {len(response)} posts in search")
            return True
        return False

    def test_get_chat_messages(self):
        """Test getting chat messages"""
        if not self.user_token:
            print("❌ User token required")
            return False

        success, response = self.run_test(
            "Get Chat Messages",
            "GET",
            "chat/general/messages",
            200,
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        if success:
            print(f"✅ Retrieved {len(response)} chat messages")
            return True
        return False

    def test_get_dm_conversations(self):
        """Test getting DM conversations"""
        if not self.user_token:
            print("❌ User token required")
            return False

        success, response = self.run_test(
            "Get DM Conversations",
            "GET",
            "dm/conversations",
            200,
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        if success:
            print(f"✅ Retrieved {len(response)} DM conversations")
            return True
        return False

    def test_get_user_profile(self):
        """Test getting user profile"""
        if not self.user_token:
            print("❌ User token required")
            return False

        success, response = self.run_test(
            "Get User Profile",
            "GET",
            "users/me",
            200,
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        if success:
            print(f"✅ Retrieved user profile for {response.get('display_name', 'Unknown')}")
            return True
        return False

    def test_update_profile(self):
        """Test updating user profile"""
        if not self.user_token:
            print("❌ User token required")
            return False

        success, response = self.run_test(
            "Update Profile",
            "PUT",
            "users/me",
            200,
            data={
                "bio": "Updated bio from API test",
                "is_profile_public": True
            },
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        if success:
            print(f"✅ Profile updated successfully")
            return True
        return False

    def test_follow_user(self):
        """Test following a user (admin)"""
        if not self.user_token:
            print("❌ User token required")
            return False

        success, response = self.run_test(
            "Follow User",
            "POST",
            "users/ADMIN001/follow",
            200,
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        if success:
            print(f"✅ Successfully followed user")
            return True
        return False

    def test_unfollow_user(self):
        """Test unfollowing a user"""
        if not self.user_token:
            print("❌ User token required")
            return False

        success, response = self.run_test(
            "Unfollow User",
            "DELETE",
            "users/ADMIN001/follow",
            200,
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        if success:
            print(f"✅ Successfully unfollowed user")
            return True
        return False

    def test_get_user_by_id(self):
        """Test getting user profile by ID number"""
        if not self.user_token:
            print("❌ User token required")
            return False

        success, response = self.run_test(
            "Get User by ID",
            "GET",
            "users/ADMIN001",
            200,
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        if success:
            print(f"✅ Retrieved user profile for {response.get('display_name', 'Unknown')}")
            return True
        return False

    def test_send_dm(self):
        """Test sending a direct message"""
        if not self.user_token or not self.admin_token:
            print("❌ Both user and admin tokens required")
            return False

        # Get admin user ID first
        admin_success, admin_response = self.run_test(
            "Get Admin Profile",
            "GET",
            "users/me",
            200,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        if not admin_success:
            return False
        
        admin_user_id = admin_response.get('user_id')
        
        success, response = self.run_test(
            "Send Direct Message",
            "POST",
            f"dm/{admin_user_id}/send",
            200,
            data={"content": "Test DM from API testing"},
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        if success:
            print(f"✅ Direct message sent successfully")
            return True
        return False

    def test_get_dm_messages(self):
        """Test getting DM messages with a specific user"""
        if not self.user_token or not self.admin_token:
            print("❌ Both user and admin tokens required")
            return False

        # Get admin user ID first
        admin_success, admin_response = self.run_test(
            "Get Admin Profile for DM",
            "GET",
            "users/me",
            200,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        if not admin_success:
            return False
        
        admin_user_id = admin_response.get('user_id')
        
        success, response = self.run_test(
            "Get DM Messages",
            "GET",
            f"dm/{admin_user_id}/messages",
            200,
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        if success:
            print(f"✅ Retrieved {len(response)} DM messages")
            return True
        return False

    def test_add_comment(self):
        """Test adding a comment to a post"""
        if not self.user_token or not self.test_post_id:
            print("❌ User token and post ID required")
            return False

        success, response = self.run_test(
            "Add Comment",
            "POST",
            f"posts/{self.test_post_id}/comment",
            200,
            data={"content": "This is a test comment from API testing"},
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        if success:
            print(f"✅ Comment added successfully")
            return True
        return False

    def test_get_user_posts(self):
        """Test getting posts by a specific user"""
        if not self.user_token:
            print("❌ User token required")
            return False

        success, response = self.run_test(
            "Get User Posts",
            "GET",
            f"posts/user/{self.test_user_data['id_number']}",
            200,
            headers={"Authorization": f"Bearer {self.user_token}"}
        )
        
        if success:
            print(f"✅ Retrieved {len(response)} posts for user")
            return True
        return False

def main():
    print("🚀 Starting BISD HUB API Testing...")
    tester = BISDHubAPITester()
    
    # Test sequence
    tests = [
        ("Root Endpoint", tester.test_root_endpoint),
        ("Admin Login", tester.test_admin_login),
        ("User Registration", tester.test_user_registration),
        ("Get Pending Registrations", tester.test_get_pending_registrations),
        ("Approve Registration", tester.test_approve_registration),
        ("User Login", tester.test_user_login),
        ("Get User Profile", tester.test_get_user_profile),
        ("Update Profile", tester.test_update_profile),
        ("Get User by ID", tester.test_get_user_by_id),
        ("Follow User", tester.test_follow_user),
        ("Unfollow User", tester.test_unfollow_user),
        ("Create Post", tester.test_create_post),
        ("Get Feed", tester.test_get_feed),
        ("Get User Posts", tester.test_get_user_posts),
        ("Like Post", tester.test_like_post),
        ("Unlike Post", tester.test_unlike_post),
        ("Add Comment", tester.test_add_comment),
        ("Search Users", tester.test_search_users),
        ("Search Posts", tester.test_search_posts),
        ("Get Chat Messages", tester.test_get_chat_messages),
        ("Get DM Conversations", tester.test_get_dm_conversations),
        ("Send Direct Message", tester.test_send_dm),
        ("Get DM Messages", tester.test_get_dm_messages),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print(f"\n📊 Test Results:")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed tests:")
        for test in failed_tests:
            print(f"  - {test}")
    else:
        print(f"\n🎉 All tests passed!")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())