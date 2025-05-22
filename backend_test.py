import requests
import sys
import uuid
from datetime import datetime

class TurdHunterAPITester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.player_id = str(uuid.uuid4())
        self.player_name = f"TestPlayer_{datetime.now().strftime('%H%M%S')}"

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                print(f"Response: {response.json()}")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.text:
                    print(f"Response: {response.text}")

            return success, response.json() if success and response.text else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        return self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )

    def test_create_score(self, difficulty="easy", time_seconds=120, moves=25, completed=True):
        """Test creating a game score"""
        return self.run_test(
            "Create Game Score",
            "POST",
            "scores",
            200,
            data={
                "player_name": self.player_name,
                "difficulty": difficulty,
                "time_seconds": time_seconds,
                "moves": moves,
                "completed": completed
            }
        )

    def test_get_scores(self, limit=10, difficulty=None):
        """Test getting high scores"""
        params = {"limit": limit}
        if difficulty:
            params["difficulty"] = difficulty
            
        return self.run_test(
            f"Get High Scores (difficulty={difficulty if difficulty else 'all'})",
            "GET",
            "scores",
            200,
            params=params
        )

    def test_get_player_scores(self):
        """Test getting scores for a specific player"""
        return self.run_test(
            f"Get Player Scores for {self.player_name}",
            "GET",
            f"scores/{self.player_name}",
            200
        )

    def test_subscription_status(self):
        """Test getting subscription status"""
        return self.run_test(
            "Get Subscription Status",
            "GET",
            f"subscription/{self.player_id}",
            200
        )

    def test_update_subscription(self, is_subscribed=True):
        """Test updating subscription status"""
        return self.run_test(
            f"Update Subscription Status to {is_subscribed}",
            "POST",
            f"subscription/{self.player_id}?is_subscribed={is_subscribed}",
            200
        )

def main():
    # Get the backend URL from environment or use default
    backend_url = "https://0874decc-183f-45db-87ad-b6e7b3d59135.preview.emergentagent.com"
    
    print(f"Testing Turd Hunter API at: {backend_url}")
    
    # Setup tester
    tester = TurdHunterAPITester(backend_url)
    
    # Run tests
    tester.test_root_endpoint()
    
    # Test score creation and retrieval
    success, score_data = tester.test_create_score()
    if success:
        print(f"Created score with ID: {score_data.get('id')}")
    
    # Test getting all scores
    tester.test_get_scores()
    
    # Test getting scores by difficulty
    tester.test_get_scores(difficulty="easy")
    
    # Test getting player scores
    tester.test_get_player_scores()
    
    # Test subscription endpoints
    tester.test_subscription_status()
    tester.test_update_subscription(True)
    tester.test_subscription_status()
    tester.test_update_subscription(False)
    
    # Print results
    print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())