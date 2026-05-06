import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
from datetime import datetime, timezone
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent / 'backend'
load_dotenv(ROOT_DIR / '.env')

role_accounts = [
    {
        "id_number": "OWNER001",
        "full_name": "Project Owner",
        "role": "Project Owner",
        "badges": ["Project Owner", "Superior"],
        "password": "owner123"
    },
    {
        "id_number": "MGMT001",
        "full_name": "Management Head",
        "role": "Management",
        "badges": ["Management", "Superior"],
        "password": "management123"
    },
    {
        "id_number": "CM001",
        "full_name": "Community Manager",
        "role": "Community Manager",
        "badges": ["Community Manager", "Admin Supervisor"],
        "password": "cm123"
    },
    {
        "id_number": "COS001",
        "full_name": "Chief of Staff",
        "role": "Chief of Staff",
        "badges": ["Chief of Staff", "Admin Supervisor"],
        "password": "cos123"
    },
    {
        "id_number": "CA001",
        "full_name": "Chief Administrator",
        "role": "Chief Administrator",
        "badges": ["Chief Administrator", "Super Admin"],
        "password": "ca123"
    },
    {
        "id_number": "HA001",
        "full_name": "Head Administrator",
        "role": "Head Administrator",
        "badges": ["Head Administrator"],
        "password": "ha123"
    },
    {
        "id_number": "ADMIN002",
        "full_name": "Administrator Two",
        "role": "Administrator",
        "badges": ["Administrator"],
        "password": "admin2123"
    },
    {
        "id_number": "CMOD001",
        "full_name": "Chief Moderator",
        "role": "Chief Moderator",
        "badges": ["Chief Moderator", "Super Mod"],
        "password": "cmod123"
    },
    {
        "id_number": "HMOD001",
        "full_name": "Head Moderator",
        "role": "Head Moderator",
        "badges": ["Head Moderator", "Super Mod"],
        "password": "hmod123"
    },
    {
        "id_number": "MOD001",
        "full_name": "Moderator One",
        "role": "Moderator",
        "badges": ["Moderator"],
        "password": "mod123"
    },
    {
        "id_number": "USER001",
        "full_name": "Test User One",
        "role": "user",
        "badges": [],
        "password": "user123"
    }
]

async def create_role_accounts():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("Creating role-based test accounts...")
    
    for account in role_accounts:
        # Check if exists
        existing = await db.users.find_one({"id_number": account["id_number"]}, {"_id": 0})
        if existing:
            print(f"✗ {account['role']} ({account['id_number']}) already exists")
            continue
        
        password_hash = bcrypt.hashpw(account['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Determine admin/moderator flags
        admin_roles = ["Administrator", "Head Administrator", "Chief Administrator", "Chief of Staff", "Community Manager", "Management", "Project Owner"]
        mod_roles = ["Moderator", "Head Moderator", "Chief Moderator"]
        
        is_admin = account['role'] in admin_roles
        is_moderator = account['role'] in mod_roles or is_admin
        
        user_doc = {
            "user_id": f"user-{account['id_number'].lower()}",
            "id_number": account['id_number'],
            "full_name": account['full_name'],
            "display_name": account['full_name'],
            "date_of_birth": "01/01/1990",
            "current_class": "Grade 10",
            "section": "B1",
            "email": f"{account['id_number'].lower()}@bisdhub.com",
            "phone_number": None,
            "is_ex_student": False,
            "date_of_leaving": None,
            "last_class": None,
            "password_hash": password_hash,
            "profile_picture": None,
            "banner_image": "https://static.prod-images.emergentagent.com/jobs/17b61164-1d10-46cf-baba-b1316ac6e12c/images/3363304a1d6cf6e5fdb07fb61d2e7c00bb6c265629ca175243351c3baa65a1b2.png",
            "bio": f"{account['role']} account for testing",
            "badges": account['badges'],
            "role": account['role'],
            "is_profile_public": True,
            "is_admin": is_admin,
            "is_moderator": is_moderator,
            "is_banned": False,
            "is_muted": False,
            "ban_reason": None,
            "mute_until": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "followers": [],
            "following": []
        }
        
        await db.users.insert_one(user_doc)
        print(f"✓ Created {account['role']}: {account['id_number']} / {account['password']}")
    
    print("\n=== All Test Accounts Created ===")
    print("\nAccount Summary:")
    for account in role_accounts:
        print(f"{account['role']:25} | ID: {account['id_number']:12} | Password: {account['password']}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_role_accounts())
