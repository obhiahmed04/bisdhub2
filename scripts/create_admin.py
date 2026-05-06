import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
from datetime import datetime, timezone
import os
from dotenv import load_dotenv
from pathlib import Path

# Load env
ROOT_DIR = Path(__file__).parent.parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

async def create_admin():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Check if admin exists
    existing = await db.users.find_one({"id_number": "ADMIN001"}, {"_id": 0})
    if existing:
        print("Admin already exists!")
        return
    
    # Create admin user
    password_hash = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    admin_user = {
        "user_id": "admin-user-001",
        "id_number": "ADMIN001",
        "full_name": "BISD Administrator",
        "display_name": "Admin",
        "date_of_birth": "01/01/1990",
        "current_class": "N/A",
        "section": "N/A",
        "email": "admin@bisdhub.com",
        "phone_number": None,
        "is_ex_student": False,
        "date_of_leaving": None,
        "last_class": None,
        "password_hash": password_hash,
        "profile_picture": None,
        "banner_image": "https://static.prod-images.emergentagent.com/jobs/17b61164-1d10-46cf-baba-b1316ac6e12c/images/3363304a1d6cf6e5fdb07fb61d2e7c00bb6c265629ca175243351c3baa65a1b2.png",
        "bio": "BISD HUB Administrator",
        "badges": ["Administrator"],
        "is_profile_public": True,
        "is_admin": True,
        "is_moderator": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "followers": [],
        "following": []
    }
    
    await db.users.insert_one(admin_user)
    print("Admin user created successfully!")
    print("ID Number: ADMIN001")
    print("Password: admin123")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_admin())
