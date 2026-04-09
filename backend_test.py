import requests
import sys
from datetime import datetime
import json

class DevOSAPITester:
    def __init__(self, base_url="https://codecraft-hub-21.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                self.failed_tests.append(f"{name}: Expected {expected_status}, got {response.status_code}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append(f"{name}: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_platform_stats(self):
        """Test platform statistics endpoint"""
        return self.run_test("Platform Stats", "GET", "stats", 200)

    def test_demo_access_client(self):
        """Test demo access for client"""
        success, response = self.run_test(
            "Demo Access - Client",
            "POST",
            "auth/demo",
            200,
            data={"role": "client"}
        )
        if success and 'user_id' in response:
            print(f"   Created demo client: {response.get('email')}")
            return True, response
        return False, {}

    def test_demo_access_developer(self):
        """Test demo access for developer"""
        success, response = self.run_test(
            "Demo Access - Developer",
            "POST",
            "auth/demo",
            200,
            data={"role": "developer"}
        )
        if success and 'user_id' in response:
            print(f"   Created demo developer: {response.get('email')}")
            return True, response
        return False, {}

    def test_demo_access_admin(self):
        """Test demo access for admin"""
        success, response = self.run_test(
            "Demo Access - Admin",
            "POST",
            "auth/demo",
            200,
            data={"role": "admin"}
        )
        if success and 'user_id' in response:
            print(f"   Created demo admin: {response.get('email')}")
            return True, response
        return False, {}

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_user = {
            "email": f"test_user_{timestamp}@devos.test",
            "password": "TestPass123!",
            "name": f"Test User {timestamp}",
            "role": "client"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user
        )
        
        if success and 'user_id' in response:
            print(f"   Registered user: {response.get('email')}")
            return True, response
        return False, {}

    def test_user_login(self):
        """Test user login with registered user"""
        # First register a user
        timestamp = datetime.now().strftime('%H%M%S')
        test_user = {
            "email": f"test_login_{timestamp}@devos.test",
            "password": "TestPass123!",
            "name": f"Test Login User {timestamp}",
            "role": "client"
        }
        
        # Register
        reg_success, reg_response = self.run_test(
            "Registration for Login Test",
            "POST",
            "auth/register",
            200,
            data=test_user
        )
        
        if not reg_success:
            return False, {}
        
        # Now test login
        login_data = {
            "email": test_user["email"],
            "password": test_user["password"]
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'user_id' in response:
            print(f"   Logged in user: {response.get('email')}")
            return True, response
        return False, {}

    def test_auth_me_without_token(self):
        """Test /auth/me without authentication"""
        return self.run_test("Auth Me - No Token", "GET", "auth/me", 401)

    def test_portfolio_cases(self):
        """Test portfolio cases endpoint"""
        return self.run_test("Portfolio Cases", "GET", "portfolio/cases", 200)

    def test_featured_cases(self):
        """Test featured portfolio cases"""
        return self.run_test("Featured Cases", "GET", "portfolio/featured", 200)

    def print_summary(self):
        """Print test summary"""
        print(f"\n{'='*60}")
        print(f"📊 TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"   - {test}")
        
        return self.tests_passed == self.tests_run

def main():
    print("🚀 Starting Development OS API Testing...")
    print(f"Backend URL: https://codecraft-hub-21.preview.emergentagent.com")
    
    tester = DevOSAPITester()
    
    # Test basic endpoints
    print(f"\n{'='*60}")
    print("🔧 BASIC API TESTS")
    print(f"{'='*60}")
    
    tester.test_root_endpoint()
    tester.test_platform_stats()
    tester.test_portfolio_cases()
    tester.test_featured_cases()
    
    # Test authentication endpoints
    print(f"\n{'='*60}")
    print("🔐 AUTHENTICATION TESTS")
    print(f"{'='*60}")
    
    tester.test_auth_me_without_token()
    tester.test_user_registration()
    tester.test_user_login()
    
    # Test demo access
    print(f"\n{'='*60}")
    print("🎭 DEMO ACCESS TESTS")
    print(f"{'='*60}")
    
    tester.test_demo_access_client()
    tester.test_demo_access_developer()
    tester.test_demo_access_admin()
    
    # Print final summary
    success = tester.print_summary()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())