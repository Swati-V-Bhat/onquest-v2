"""Seed OnQuest with 10 Indian users + 50 real-destination quests."""
import asyncio
import os
import uuid
import random
import bcrypt
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]


def hp(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def now_iso(days_ago=0):
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


# 10 Indian users
USERS = [
    ("aarav.sharma@onquest.in",  "Aarav Sharma",   "Mountain seeker. Bullets & ramen.",         "Quest@123"),
    ("priya.iyer@onquest.in",    "Priya Iyer",     "Foodie wanderer from Chennai.",              "Quest@123"),
    ("rohan.kapoor@onquest.in",  "Rohan Kapoor",   "Photographer chasing golden hour.",          "Quest@123"),
    ("ananya.reddy@onquest.in",  "Ananya Reddy",   "Solo explorer, slow travel believer.",       "Quest@123"),
    ("vikram.singh@onquest.in",  "Vikram Singh",   "Long road, longer playlists.",               "Quest@123"),
    ("meera.nair@onquest.in",    "Meera Nair",     "Backwaters, books, and biryani.",            "Quest@123"),
    ("aditya.patel@onquest.in",  "Aditya Patel",   "Trekker. 7 states, 12 summits.",             "Quest@123"),
    ("sneha.joshi@onquest.in",   "Sneha Joshi",    "Heritage hunter & street food fan.",         "Quest@123"),
    ("arjun.verma@onquest.in",   "Arjun Verma",    "Surf, sand, and sunsets.",                   "Quest@123"),
    ("kavya.menon@onquest.in",   "Kavya Menon",    "Workation queen. Cafes > meeting rooms.",    "Quest@123"),
]

# Image pool by destination theme (Unsplash hotlinks - verified working)
IMG = {
    "manali":    "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=1200&auto=format&fit=crop",
    "spiti":     "https://images.unsplash.com/photo-1626714555274-8e0d4f0e2d9d?q=80&w=1200&auto=format&fit=crop",
    "ladakh":    "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=1200&auto=format&fit=crop",
    "rishikesh": "https://images.unsplash.com/photo-1591018653308-fed4ad520fa1?q=80&w=1200&auto=format&fit=crop",
    "varanasi":  "https://images.unsplash.com/photo-1561361398-a8b0d3c1d8cf?q=80&w=1200&auto=format&fit=crop",
    "jaipur":    "https://images.unsplash.com/photo-1599661046827-dacde6976549?q=80&w=1200&auto=format&fit=crop",
    "udaipur":   "https://images.unsplash.com/photo-1599661046289-e31897846e41?q=80&w=1200&auto=format&fit=crop",
    "goa_north": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=1200&auto=format&fit=crop",
    "goa_south": "https://images.unsplash.com/photo-1517400508447-f8dd518b86db?q=80&w=1200&auto=format&fit=crop",
    "kerala":    "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?q=80&w=1200&auto=format&fit=crop",
    "munnar":    "https://images.unsplash.com/photo-1591025810197-83f59ec0fa84?q=80&w=1200&auto=format&fit=crop",
    "alleppey":  "https://images.unsplash.com/photo-1611516491426-03025e6043c8?q=80&w=1200&auto=format&fit=crop",
    "hampi":     "https://images.unsplash.com/photo-1606298855672-3efb63017be8?q=80&w=1200&auto=format&fit=crop",
    "coorg":     "https://images.unsplash.com/photo-1599629954294-14df9ec8bc03?q=80&w=1200&auto=format&fit=crop",
    "pondi":     "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?q=80&w=1200&auto=format&fit=crop",
    "gokarna":   "https://images.unsplash.com/photo-1580836623504-2cf75bcf0a6e?q=80&w=1200&auto=format&fit=crop",
    "darjeeling":"https://images.unsplash.com/photo-1605649461784-4cb5cdee0d65?q=80&w=1200&auto=format&fit=crop",
    "andaman":   "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?q=80&w=1200&auto=format&fit=crop",
    "auli":      "https://images.unsplash.com/photo-1605649461858-87c0a1086f8b?q=80&w=1200&auto=format&fit=crop",
    "mahabaleshwar": "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=1200&auto=format&fit=crop",
    "mussoorie": "https://images.unsplash.com/photo-1605649461858-87c0a1086f8b?q=80&w=1200&auto=format&fit=crop",
    "default":   "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=1200&auto=format&fit=crop",
}


def n(title, kind, lat, lng, loc, desc, img_key="default"):
    return {
        "title": title, "type": kind, "lat": lat, "lng": lng,
        "location_name": loc, "description": desc,
        "photo_base64": IMG.get(img_key, IMG["default"]),
    }


# 50 quests across 10 popular Indian destinations
QUESTS = [
    # ---- MANALI / SPITI (5) ----
    {"cover": IMG["manali"], "title": "Manali to Spiti: Cold Desert Loop",
     "description": "An 8-day Royal Enfield circuit through Atal Tunnel, Chandratal, Kaza and Kibber. Snowy passes, monastery chai, and the bluest skies you'll ever ride under.",
     "nodes": [
        n("Old Manali Kickoff", "place", 32.2625, 77.1843, "Old Manali, HP", "Pancakes at Cafe 1947 and final luggage check.", "manali"),
        n("Atal Tunnel Crossing", "activity", 32.4067, 77.2553, "Atal Tunnel, HP", "Drove through the world's longest highway tunnel above 10,000 ft.", "manali"),
        n("Chandratal Lake", "place", 32.4744, 77.6133, "Chandratal, Spiti", "Camped under stars at the moon-shaped lake.", "spiti"),
        n("Kaza Monastery Chai", "activity", 32.2272, 78.0726, "Kaza, Spiti", "Prayer flags, momos, and stories from the lama.", "spiti"),
        n("Kibber Village", "place", 32.3320, 78.0150, "Kibber, Spiti", "World's highest motorable village. Ate at a homestay run by Tashi ji.", "spiti"),
     ]},
    {"cover": IMG["manali"], "title": "Solang Adventure Weekend",
     "description": "A budget 3-day rush of paragliding, zorbing, and Sissu noodles. Perfect for college groups.",
     "nodes": [
        n("Solang Valley", "place", 32.3193, 77.1573, "Solang Valley, HP", "Paragliding at sunrise, INR 2500 per flight.", "manali"),
        n("Sissu Waterfall", "place", 32.4796, 77.1190, "Sissu, HP", "Glacial water, Maggi point with the best view.", "manali"),
        n("Vashisht Hot Springs", "activity", 32.2697, 77.1864, "Vashisht, Manali", "Sulphur springs to thaw out at night.", "manali"),
     ]},
    {"cover": IMG["manali"], "title": "Tosh + Kasol Slow Trail",
     "description": "Stoner-friendly walks through Parvati Valley, Israeli cafes, riverside tents.",
     "nodes": [
        n("Kasol Riverside", "place", 32.0094, 77.3149, "Kasol, HP", "Camped beside Parvati. Bonfire & shakshuka.", "manali"),
        n("Tosh Village", "place", 32.2333, 77.3833, "Tosh, HP", "Wooden cabins, sunrise over Kheerganga ridge.", "manali"),
        n("Chalal Trek", "activity", 32.0167, 77.3333, "Chalal, HP", "Easy 3km riverside walk with cafes en route.", "manali"),
     ]},
    {"cover": IMG["manali"], "title": "Bhrigu Lake High-Altitude Trek",
     "description": "4-day moderate trek to a 14,000 ft glacial lake. Snow even in May.",
     "nodes": [
        n("Gulaba Basecamp", "place", 32.3522, 77.1822, "Gulaba, HP", "Met our trek leader Mahesh.", "manali"),
        n("Rolla Camp", "place", 32.3950, 77.2300, "Rolla, HP", "Pine-forest camp, freezing nights.", "manali"),
        n("Bhrigu Lake Summit", "activity", 32.4283, 77.2417, "Bhrigu Lake, HP", "Frozen lake at 4240m. Indescribable.", "manali"),
     ]},
    {"cover": IMG["manali"], "title": "Manali Cafe Hop",
     "description": "Two days of caffeine, books, and slow mornings.",
     "nodes": [
        n("Cafe 1947", "activity", 32.2625, 77.1843, "Old Manali", "Wood-fired pizza by the river.", "manali"),
        n("Drifters' Inn", "activity", 32.2630, 77.1820, "Old Manali", "Best black coffee + open mic night.", "manali"),
        n("Johnson's Cafe", "activity", 32.2525, 77.1900, "Manali", "Trout meal under apple trees.", "manali"),
     ]},

    # ---- LADAKH (5) ----
    {"cover": IMG["ladakh"], "title": "Leh-Ladakh Bike Diaries",
     "description": "10 days, 6 passes, 1 unforgettable memory. Manali to Leh via Sarchu.",
     "nodes": [
        n("Manali Start", "place", 32.2432, 77.1892, "Manali", "Royal Enfield rented at Hadimba Road.", "manali"),
        n("Sarchu Camp", "place", 32.9111, 77.5167, "Sarchu", "Slept at 14,000ft, mild AMS.", "ladakh"),
        n("Pangong Tso", "place", 33.7556, 78.6450, "Pangong Lake", "The 3 Idiots scooty spot. Camped overnight.", "ladakh"),
        n("Khardung La", "activity", 34.2778, 77.6047, "Khardung La", "World's highest motorable pass — 18,380 ft.", "ladakh"),
        n("Nubra Valley", "place", 34.6700, 77.5833, "Nubra Valley", "Double-humped camels at Hunder dunes.", "ladakh"),
     ]},
    {"cover": IMG["ladakh"], "title": "Leh Monastery Trail",
     "description": "Slow 4-day cultural circuit of Hemis, Thiksey, Diskit, and Likir.",
     "nodes": [
        n("Thiksey Monastery", "place", 34.0556, 77.6669, "Thiksey", "Sunrise prayers + butter tea.", "ladakh"),
        n("Hemis Monastery", "place", 33.9128, 77.7053, "Hemis", "Largest gompa in Ladakh.", "ladakh"),
        n("Shey Palace", "place", 34.0828, 77.6172, "Shey", "13m tall Buddha statue, surreal silence.", "ladakh"),
     ]},
    {"cover": IMG["ladakh"], "title": "Tso Moriri Camping Quest",
     "description": "Less crowded than Pangong, twice as serene.",
     "nodes": [
        n("Tso Moriri Lake", "place", 32.9000, 78.3000, "Tso Moriri", "Wild horses + flamingos in summer.", "ladakh"),
        n("Korzok Village", "activity", 32.9333, 78.3000, "Korzok", "Stayed at homestay, learnt to cook thukpa.", "ladakh"),
     ]},
    {"cover": IMG["ladakh"], "title": "Chadar Frozen River Trek",
     "description": "9-day extreme winter trek on the frozen Zanskar river.",
     "nodes": [
        n("Chilling Start", "place", 34.0333, 77.3500, "Chilling, Ladakh", "Trek begins where the road ends.", "ladakh"),
        n("Tilat Sumdo Camp", "place", 34.0500, 77.2833, "Tilat Sumdo", "Sleeping in caves at -25°C.", "ladakh"),
        n("Nerak Falls", "activity", 33.7500, 77.2333, "Nerak", "Frozen waterfall — surreal blue.", "ladakh"),
     ]},
    {"cover": IMG["ladakh"], "title": "Leh Foodie Rounds",
     "description": "From thukpa to apricot wine — Leh's underrated food scene.",
     "nodes": [
        n("Tibetan Kitchen", "activity", 34.1642, 77.5848, "Leh Main Bazaar", "Best mok-mok (momos) in town.", "ladakh"),
        n("Bon Appetit", "activity", 34.1655, 77.5832, "Changspa Road", "Apple pie + mountain views.", "ladakh"),
        n("Lala's Cafe", "activity", 34.1670, 77.5860, "Old Town Leh", "Heritage cafe, must-try Sea Buckthorn juice.", "ladakh"),
     ]},

    # ---- GOA (5) ----
    {"cover": IMG["goa_north"], "title": "North Goa Beach Hopper",
     "description": "5 days, 6 beaches, infinite susegado. Anjuna, Vagator, Arambol.",
     "nodes": [
        n("Vagator Beach", "place", 15.5996, 73.7440, "Vagator, North Goa", "Cliffside sunsets at Thalassa.", "goa_north"),
        n("Anjuna Flea Market", "activity", 15.5736, 73.7400, "Anjuna", "Wednesday market, picked up shell jewellery.", "goa_north"),
        n("Arambol Drum Circle", "activity", 15.6864, 73.7042, "Arambol", "Sunday drum circle on the beach.", "goa_north"),
        n("Chapora Fort", "place", 15.6048, 73.7355, "Chapora", "DDLJ — sorry, Dil Chahta Hai — view.", "goa_north"),
     ]},
    {"cover": IMG["goa_south"], "title": "South Goa Slow Beach Days",
     "description": "Quiet shacks, Portuguese villages, no drum circles. Pure calm.",
     "nodes": [
        n("Palolem Beach", "place", 15.0100, 74.0233, "Palolem, South Goa", "Hammock, kayak, sunset, repeat.", "goa_south"),
        n("Cabo de Rama Fort", "place", 15.0833, 73.9333, "Cabo de Rama", "Cliff fort with empty beach below.", "goa_south"),
        n("Agonda Beach", "place", 15.0428, 73.9842, "Agonda", "Olive ridley turtles nest here.", "goa_south"),
     ]},
    {"cover": IMG["goa_north"], "title": "Goan Food Pilgrimage",
     "description": "From bebinca to xacuti — a Goan food crawl.",
     "nodes": [
        n("Vinayak Family Restaurant", "activity", 15.5469, 73.7553, "Assagao", "Best fish thali in Goa, INR 350.", "goa_north"),
        n("Gunpowder", "activity", 15.5933, 73.7372, "Assagao", "South Indian heritage food.", "goa_north"),
        n("Mum's Kitchen", "activity", 15.4833, 73.8167, "Panjim", "Authentic Goan fish curry rice.", "goa_north"),
     ]},
    {"cover": IMG["goa_north"], "title": "Old Goa Heritage Walk",
     "description": "Portuguese churches, latin quarters, Fontainhas painted streets.",
     "nodes": [
        n("Basilica of Bom Jesus", "place", 15.5007, 73.9117, "Old Goa", "Houses St. Francis Xavier's relics.", "goa_north"),
        n("Fontainhas Latin Quarter", "place", 15.4961, 73.8281, "Panjim", "Yellow-blue painted heritage homes.", "goa_north"),
        n("Reis Magos Fort", "place", 15.4975, 73.8089, "Reis Magos", "Best Mandovi river view.", "goa_north"),
     ]},
    {"cover": IMG["goa_south"], "title": "Dudhsagar Falls Day Trip",
     "description": "From Madgaon, jeep safari into Bhagwan Mahaveer sanctuary.",
     "nodes": [
        n("Castle Rock Station", "place", 15.4083, 74.3208, "Castle Rock", "Started early train ride.", "goa_south"),
        n("Dudhsagar Falls", "activity", 15.3144, 74.3144, "Dudhsagar", "4th tallest in India. INR 600 jeep.", "goa_south"),
        n("Spice Plantation", "activity", 15.4233, 74.0589, "Ponda", "Cardamom, vanilla & elephant rides.", "goa_south"),
     ]},

    # ---- RAJASTHAN (5) ----
    {"cover": IMG["jaipur"], "title": "Pink City Heritage Quest",
     "description": "3 days exploring Jaipur's forts, palaces and bazaars.",
     "nodes": [
        n("Amer Fort", "place", 26.9855, 75.8513, "Amer, Jaipur", "Sunrise climb, elephant ride is overrated.", "jaipur"),
        n("Hawa Mahal", "place", 26.9239, 75.8267, "Jaipur", "Honeycomb facade, perfect for photos.", "jaipur"),
        n("Bapu Bazaar", "activity", 26.9159, 75.8197, "Jaipur", "Block prints + lac bangles.", "jaipur"),
        n("Nahargarh Sunset", "activity", 26.9376, 75.8154, "Nahargarh Fort", "City lights view, must-do.", "jaipur"),
     ]},
    {"cover": IMG["udaipur"], "title": "Udaipur Lakes & Palaces",
     "description": "City of Lakes — Pichola boat rides, Jagmandir lunches.",
     "nodes": [
        n("City Palace Udaipur", "place", 24.5760, 73.6831, "Udaipur", "Lake Pichola views from terrace.", "udaipur"),
        n("Lake Pichola Boat", "activity", 24.5750, 73.6800, "Lake Pichola", "Sunset boat ride INR 1000.", "udaipur"),
        n("Bagore ki Haveli", "place", 24.5770, 73.6826, "Udaipur", "Folk dance show at 7pm.", "udaipur"),
     ]},
    {"cover": IMG["jaipur"], "title": "Jaisalmer Desert Camp",
     "description": "Sam dunes, camel safari, kalbeliya dance under stars.",
     "nodes": [
        n("Jaisalmer Fort", "place", 26.9124, 70.9120, "Jaisalmer", "Living fort with shops + havelis inside.", "jaipur"),
        n("Sam Sand Dunes", "place", 26.7444, 70.5167, "Sam, Thar Desert", "Camel safari at sunset.", "jaipur"),
        n("Patwon Ki Haveli", "place", 26.9156, 70.9156, "Jaisalmer", "Carved sandstone masterpiece.", "jaipur"),
     ]},
    {"cover": IMG["jaipur"], "title": "Jodhpur Blue City Walk",
     "description": "Mehrangarh, omelette shop, blue alleys.",
     "nodes": [
        n("Mehrangarh Fort", "place", 26.2967, 73.0189, "Jodhpur", "One of India's largest forts.", "jaipur"),
        n("Stepwell Toorji ka Jhalra", "place", 26.2983, 73.0244, "Jodhpur", "Carved 18th-century stepwell.", "jaipur"),
        n("Shahi Samosa", "activity", 26.2950, 73.0175, "Jodhpur", "Pyaaz kachori under INR 30.", "jaipur"),
     ]},
    {"cover": IMG["udaipur"], "title": "Pushkar Camel Fair Trip",
     "description": "Annual fair, hot-air balloon, ghat aarti.",
     "nodes": [
        n("Pushkar Lake", "place", 26.4878, 74.5511, "Pushkar", "Sacred lake, evening aarti.", "jaipur"),
        n("Brahma Temple", "place", 26.4894, 74.5511, "Pushkar", "One of few Brahma temples in the world.", "jaipur"),
        n("Camel Fair Ground", "activity", 26.4900, 74.5450, "Pushkar Mela", "Cattle, hot-air balloons, mustache contests!", "jaipur"),
     ]},

    # ---- KERALA (5) ----
    {"cover": IMG["kerala"], "title": "Alleppey Houseboat Magic",
     "description": "2 nights on a kettuvallam through the backwaters.",
     "nodes": [
        n("Alleppey Boat Jetty", "place", 9.4981, 76.3388, "Alleppey", "Boarded our houseboat at noon.", "alleppey"),
        n("Kumarakom Bird Sanctuary", "place", 9.6175, 76.4267, "Kumarakom", "Spotted darters and herons.", "kerala"),
        n("Kuttanad Paddy Fields", "place", 9.4500, 76.4167, "Kuttanad", "Below sea-level rice fields.", "alleppey"),
     ]},
    {"cover": IMG["munnar"], "title": "Munnar Tea Trail",
     "description": "Misty mornings, tea estates, Eravikulam national park.",
     "nodes": [
        n("Kolukkumalai Estate", "place", 10.1500, 77.2500, "Munnar", "Highest tea estate in the world.", "munnar"),
        n("Eravikulam NP", "activity", 10.1819, 77.0589, "Eravikulam", "Spotted Nilgiri tahr at 7000ft.", "munnar"),
        n("Mattupetty Dam", "place", 10.1015, 77.1273, "Mattupetty", "Boating + horse rides.", "munnar"),
     ]},
    {"cover": IMG["kerala"], "title": "Fort Kochi Heritage Walk",
     "description": "Chinese fishing nets, Jew Town antiques, Kathakali.",
     "nodes": [
        n("Chinese Fishing Nets", "place", 9.9647, 76.2419, "Fort Kochi", "Sunset over the Arabian Sea.", "kerala"),
        n("Jew Town Antiques", "activity", 9.9580, 76.2592, "Mattancherry", "Spices, antiques, paradesi synagogue.", "kerala"),
        n("Kathakali Show", "activity", 9.9656, 76.2475, "Fort Kochi", "1.5hr show with makeup demonstration.", "kerala"),
     ]},
    {"cover": IMG["munnar"], "title": "Wayanad Wilderness",
     "description": "Edakkal caves, Banasura dam, coffee estates.",
     "nodes": [
        n("Edakkal Caves", "place", 11.6258, 76.2539, "Wayanad", "5000 year-old petroglyphs.", "munnar"),
        n("Banasura Sagar Dam", "place", 11.6731, 75.9264, "Wayanad", "Largest earth dam in India.", "munnar"),
        n("Chembra Peak", "activity", 11.5500, 76.0833, "Chembra Peak", "Heart-shaped lake at the top.", "munnar"),
     ]},
    {"cover": IMG["kerala"], "title": "Varkala Cliff Stay",
     "description": "Yoga at sunrise, cliffside cafes, Papanasam beach.",
     "nodes": [
        n("Varkala Cliff", "place", 8.7378, 76.7064, "Varkala", "Cliffside cafes overlooking Arabian Sea.", "kerala"),
        n("Papanasam Beach", "activity", 8.7367, 76.7100, "Varkala", "Holy beach, dolphin spotting.", "kerala"),
        n("Sivagiri Mutt", "place", 8.7339, 76.7000, "Varkala", "Sree Narayana Guru's pilgrimage site.", "kerala"),
     ]},

    # ---- VARANASI / RISHIKESH (5) ----
    {"cover": IMG["varanasi"], "title": "Varanasi Ghat Journey",
     "description": "Sunrise boat, evening Ganga aarti, lassi & kachori.",
     "nodes": [
        n("Assi Ghat Sunrise", "activity", 25.2820, 82.9989, "Varanasi", "Sunrise boat ride, INR 600 per head.", "varanasi"),
        n("Dashashwamedh Aarti", "activity", 25.3076, 82.9882, "Varanasi", "Evening Ganga aarti, arrive 1hr early.", "varanasi"),
        n("Blue Lassi Shop", "activity", 25.3095, 82.9996, "Varanasi", "1925-old lassi shop, mango is goat.", "varanasi"),
        n("Sarnath", "place", 25.3811, 83.0214, "Sarnath", "Where Buddha gave first sermon.", "varanasi"),
     ]},
    {"cover": IMG["rishikesh"], "title": "Rishikesh Spiritual Adventure",
     "description": "Yoga, river rafting, Beatles ashram.",
     "nodes": [
        n("Lakshman Jhula", "place", 30.1283, 78.3289, "Rishikesh", "Iconic suspension bridge.", "rishikesh"),
        n("Beatles Ashram", "place", 30.1183, 78.3247, "Rishikesh", "Where the Beatles meditated in 1968.", "rishikesh"),
        n("Ganga Rafting", "activity", 30.1153, 78.2906, "Brahmpuri", "16km rafting with Grade III rapids.", "rishikesh"),
        n("Triveni Ghat Aarti", "activity", 30.1083, 78.2961, "Rishikesh", "Sunset aarti by Ganges.", "rishikesh"),
     ]},
    {"cover": IMG["rishikesh"], "title": "Haridwar Kumbh Diaries",
     "description": "Holy dip, Mansa Devi ropeway, evening aarti.",
     "nodes": [
        n("Har Ki Pauri", "activity", 29.9577, 78.1716, "Haridwar", "Famous bathing ghat & aarti.", "rishikesh"),
        n("Mansa Devi Temple", "place", 29.9694, 78.1644, "Haridwar", "Cable car ride up.", "rishikesh"),
        n("Chandi Devi Temple", "place", 29.9472, 78.1825, "Haridwar", "Across Ganges, less crowded.", "rishikesh"),
     ]},
    {"cover": IMG["rishikesh"], "title": "Valley of Flowers Trek",
     "description": "5 days through Govindghat to Hemkund + Valley of Flowers.",
     "nodes": [
        n("Govindghat", "place", 30.6167, 79.5667, "Govindghat", "Trail starts here.", "rishikesh"),
        n("Ghangaria Camp", "place", 30.6750, 79.6167, "Ghangaria", "Last village before flowers.", "rishikesh"),
        n("Valley of Flowers", "activity", 30.7283, 79.6056, "Valley of Flowers NP", "300+ flower species in monsoon.", "rishikesh"),
        n("Hemkund Sahib", "place", 30.7021, 79.6131, "Hemkund Sahib", "World's highest gurudwara — 4329m.", "rishikesh"),
     ]},
    {"cover": IMG["varanasi"], "title": "Khajuraho Temple Tour",
     "description": "UNESCO temples, sound & light show.",
     "nodes": [
        n("Western Group Temples", "place", 24.8527, 79.9317, "Khajuraho", "Kandariya Mahadev — finest carvings.", "varanasi"),
        n("Eastern Jain Temples", "place", 24.8553, 79.9444, "Khajuraho", "Quieter, equally beautiful.", "varanasi"),
        n("Sound & Light Show", "activity", 24.8525, 79.9311, "Khajuraho", "Amitabh Bachchan narration.", "varanasi"),
     ]},

    # ---- KARNATAKA (5) ----
    {"cover": IMG["hampi"], "title": "Hampi Boulder Country",
     "description": "UNESCO ruins, hippie island, sunrise at Matanga.",
     "nodes": [
        n("Virupaksha Temple", "place", 15.3350, 76.4600, "Hampi", "9th century Shiva temple, still active.", "hampi"),
        n("Vittala Temple", "place", 15.3424, 76.4756, "Hampi", "Stone chariot — INR 50 note icon.", "hampi"),
        n("Matanga Hill Sunrise", "activity", 15.3372, 76.4642, "Matanga Hill", "Best 360° view of Hampi.", "hampi"),
        n("Hippie Island", "place", 15.3478, 76.4675, "Anegundi", "Coracle ride, Mango Tree cafe.", "hampi"),
     ]},
    {"cover": IMG["coorg"], "title": "Coorg Coffee Country",
     "description": "Plantation walks, Madikeri waterfalls, rakti chicken.",
     "nodes": [
        n("Abbey Falls", "place", 12.4533, 75.7378, "Madikeri, Coorg", "Powerful monsoon waterfall.", "coorg"),
        n("Tata Coffee Plantation", "activity", 12.3500, 75.7833, "Pollibetta", "Plantation walk + coffee tasting.", "coorg"),
        n("Raja's Seat", "place", 12.4244, 75.7383, "Madikeri", "Sunset point of kings.", "coorg"),
     ]},
    {"cover": IMG["gokarna"], "title": "Gokarna Beach Trek",
     "description": "Trek between Om, Half-moon, Paradise beaches.",
     "nodes": [
        n("Om Beach", "place", 14.5333, 74.3167, "Gokarna", "Shape of Om symbol.", "gokarna"),
        n("Half Moon Beach", "place", 14.5278, 74.3122, "Gokarna", "Trekked over cliffs from Om.", "gokarna"),
        n("Paradise Beach", "place", 14.5222, 74.3083, "Gokarna", "Most secluded — bring own water.", "gokarna"),
        n("Mahabaleshwar Temple", "place", 14.5483, 74.3194, "Gokarna", "Atma Linga shrine.", "gokarna"),
     ]},
    {"cover": IMG["coorg"], "title": "Chikmagalur Coffee & Hills",
     "description": "Kemmangundi, Mullayanagiri summit, Bababudangiri.",
     "nodes": [
        n("Mullayanagiri Peak", "activity", 13.3917, 75.7167, "Chikmagalur", "Highest peak in Karnataka — 1930m.", "coorg"),
        n("Bababudangiri", "place", 13.4267, 75.7569, "Chikmagalur", "Where coffee was first cultivated in India.", "coorg"),
        n("Hebbe Falls", "place", 13.5500, 75.7833, "Kemmangundi", "Two-tier waterfall, 4km jeep ride.", "coorg"),
     ]},
    {"cover": IMG["hampi"], "title": "Mysore Royal Run",
     "description": "Palace, Chamundi Hills, Mysore pak.",
     "nodes": [
        n("Mysore Palace", "place", 12.3052, 76.6552, "Mysore", "100,000 lights on Sundays.", "hampi"),
        n("Chamundi Hill Temple", "place", 12.2725, 76.6708, "Mysore", "1000 steps to climb.", "hampi"),
        n("Devaraja Market", "activity", 12.3072, 76.6553, "Mysore", "Flowers, sandalwood oil, bananas.", "hampi"),
     ]},

    # ---- POND/AND/DARJ/AULI/MAHA (5) ----
    {"cover": IMG["pondi"], "title": "Pondicherry French Quarter",
     "description": "Cycle through White Town, Auroville stay.",
     "nodes": [
        n("Promenade Beach", "place", 11.9344, 79.8331, "Pondicherry", "Morning walk, Gandhi statue.", "pondi"),
        n("Auroville Matrimandir", "place", 12.0083, 79.8094, "Auroville", "Golden meditation dome.", "pondi"),
        n("Cafe des Arts", "activity", 11.9311, 79.8344, "Pondicherry", "French breakfast in heritage home.", "pondi"),
     ]},
    {"cover": IMG["andaman"], "title": "Andaman Island Hopper",
     "description": "Havelock, Neil, scuba diving at sunken Japanese ship.",
     "nodes": [
        n("Radhanagar Beach", "place", 11.9833, 92.9667, "Havelock", "Asia's best beach (Times 2004).", "andaman"),
        n("Elephant Beach Snorkel", "activity", 11.9967, 92.9550, "Havelock", "Live coral 5m from shore.", "andaman"),
        n("Neil Island Bridge", "place", 11.8333, 93.0500, "Neil Island", "Natural rock formation.", "andaman"),
        n("Cellular Jail Light Show", "activity", 11.6760, 92.7479, "Port Blair", "Freedom struggle history.", "andaman"),
     ]},
    {"cover": IMG["darjeeling"], "title": "Darjeeling Toy Train Diaries",
     "description": "Tiger Hill sunrise, Glenary's bakery, monastery hop.",
     "nodes": [
        n("Tiger Hill Sunrise", "activity", 27.0036, 88.2700, "Darjeeling", "Kanchenjunga at golden hour.", "darjeeling"),
        n("Toy Train", "activity", 27.0410, 88.2663, "Darjeeling", "DHR UNESCO ride to Ghum.", "darjeeling"),
        n("Happy Valley Tea Estate", "place", 27.0533, 88.2622, "Darjeeling", "1854 tea estate tour.", "darjeeling"),
        n("Glenary's Bakery", "activity", 27.0410, 88.2663, "Chowrasta", "Fudge & macarons since 1885.", "darjeeling"),
     ]},
    {"cover": IMG["auli"], "title": "Auli Skiing Weekend",
     "description": "Cable car, beginner skiing, Joshimath stay.",
     "nodes": [
        n("Auli Ropeway", "activity", 30.5283, 79.5667, "Auli", "Asia's longest gondola — 4km.", "auli"),
        n("Auli Slopes", "activity", 30.5283, 79.5667, "Auli", "Beginner skiing INR 5000/day.", "auli"),
        n("Joshimath", "place", 30.5550, 79.5642, "Joshimath", "Adi Shankaracharya's matha.", "auli"),
     ]},
    {"cover": IMG["mahabaleshwar"], "title": "Mahabaleshwar Strawberry Trail",
     "description": "Strawberries, Pratapgad fort, Venna lake.",
     "nodes": [
        n("Mapro Garden", "activity", 17.9181, 73.6592, "Mahabaleshwar", "Strawberry milkshakes & jam factory.", "mahabaleshwar"),
        n("Pratapgad Fort", "place", 17.9358, 73.5825, "Pratapgad", "Shivaji's fort, sword fight site.", "mahabaleshwar"),
        n("Arthur's Seat", "place", 17.9056, 73.6442, "Mahabaleshwar", "Cliff edge — 1300m drop.", "mahabaleshwar"),
        n("Venna Lake", "activity", 17.9156, 73.6603, "Mahabaleshwar", "Boat ride + horse riding.", "mahabaleshwar"),
     ]},

    # ---- NORTHEAST + MORE (10) ----
    {"cover": IMG["default"], "title": "Meghalaya Living Root Bridges",
     "description": "Hike to Nongriat double-decker bridge, Cherrapunji rains.",
     "nodes": [
        n("Tyrna Village", "place", 25.2500, 91.7167, "Tyrna, Meghalaya", "Trail starts — 3500 steps down.", "default"),
        n("Nongriat Double Decker", "activity", 25.2517, 91.7236, "Nongriat", "200-yr old living root bridge.", "default"),
        n("Cherrapunji Falls", "place", 25.2701, 91.7323, "Cherrapunji", "Wettest place on earth.", "default"),
        n("Mawlynnong Cleanest Village", "place", 25.2008, 91.9097, "Mawlynnong", "Asia's cleanest village.", "default"),
     ]},
    {"cover": IMG["default"], "title": "Sikkim Yumthang Valley",
     "description": "Gangtok base, Lachung, Yumthang valley of flowers.",
     "nodes": [
        n("MG Marg Gangtok", "place", 27.3389, 88.6132, "Gangtok", "Pedestrian street, evening hangout.", "default"),
        n("Tsomgo Lake", "place", 27.3744, 88.7625, "Tsomgo", "12,400ft glacial lake, yak rides.", "default"),
        n("Lachung Village", "place", 27.6889, 88.7500, "Lachung", "Stayed at homestay, momos by fire.", "default"),
        n("Yumthang Valley", "activity", 27.8167, 88.7000, "Yumthang", "Valley of flowers, hot springs nearby.", "default"),
     ]},
    {"cover": IMG["default"], "title": "Kaziranga Rhino Safari",
     "description": "1-horned rhinos, elephant grass, jeep + elephant safari.",
     "nodes": [
        n("Kaziranga Western Range", "activity", 26.5775, 93.1714, "Kaziranga NP", "Saw 9 rhinos in 3 hours!", "default"),
        n("Elephant Safari", "activity", 26.5775, 93.1714, "Kaziranga", "1hr morning safari at INR 1500.", "default"),
        n("Hoollongapar Gibbon Sanctuary", "place", 26.7000, 94.3500, "Jorhat", "Spotted hoolock gibbon.", "default"),
     ]},
    {"cover": IMG["default"], "title": "Tawang Monastery Pilgrimage",
     "description": "Largest monastery in India, Sela Pass, Madhuri Lake.",
     "nodes": [
        n("Sela Pass", "activity", 27.5083, 92.1031, "Sela Pass", "13,700ft snow pass.", "default"),
        n("Tawang Monastery", "place", 27.5872, 91.8581, "Tawang", "400-year-old Buddhist monastery.", "default"),
        n("Madhuri Lake", "place", 27.7500, 91.7000, "Sangetsar Tso", "Frozen lake from Koyla movie.", "default"),
     ]},
    {"cover": IMG["default"], "title": "Mumbai Street Food Walk",
     "description": "Vada pav, pav bhaji, kulfi falooda — a 1-day food crawl.",
     "nodes": [
        n("Anand Stall Vile Parle", "activity", 19.0990, 72.8367, "Mumbai", "OG vada pav since 1971.", "default"),
        n("Cannon Pav Bhaji", "activity", 18.9398, 72.8347, "CST, Mumbai", "Best pav bhaji in city.", "default"),
        n("Bademiya Seekh Kebabs", "activity", 18.9219, 72.8347, "Colaba", "Late-night kebabs since 1946.", "default"),
        n("Bachelorr's Juice Centre", "activity", 18.9536, 72.8156, "Marine Drive", "Strawberry cream & sandwiches.", "default"),
     ]},
    {"cover": IMG["default"], "title": "Pune-Lonavala Monsoon Drive",
     "description": "Bhushi dam, Lohagad fort, vada pav at Sinhagad.",
     "nodes": [
        n("Bhushi Dam", "place", 18.7475, 73.4072, "Lonavala", "Monsoon waterfall stairs.", "default"),
        n("Lohagad Fort Trek", "activity", 18.7100, 73.4742, "Lohagad", "Iron Fort — Shivaji's stronghold.", "default"),
        n("Sinhagad Fort", "place", 18.3664, 73.7558, "Sinhagad", "Pithla bhakri lunch on top.", "default"),
        n("Della Adventure", "activity", 18.7544, 73.4117, "Lonavala", "Bungee, ATV, paintball — full day.", "default"),
     ]},
    {"cover": IMG["default"], "title": "Ooty Nilgiri Mountain Trip",
     "description": "Toy train from Mettupalayam, tea estates, Doddabetta peak.",
     "nodes": [
        n("Nilgiri Mountain Railway", "activity", 11.4064, 76.6932, "Ooty", "UNESCO toy train ride.", "default"),
        n("Doddabetta Peak", "place", 11.4036, 76.7392, "Ooty", "Highest peak in Tamil Nadu — 2637m.", "default"),
        n("Tea Museum", "place", 11.4110, 76.7000, "Coonoor", "Tea factory tour + tasting.", "default"),
        n("Pykara Falls", "place", 11.4708, 76.6233, "Pykara", "Boating + waterfall.", "default"),
     ]},
    {"cover": IMG["mussoorie"], "title": "Mussoorie & Landour",
     "description": "Char dukan, Camel's Back road, Ruskin Bond's bookshop.",
     "nodes": [
        n("Mall Road Mussoorie", "place", 30.4598, 78.0644, "Mussoorie", "Evening promenade.", "mussoorie"),
        n("Char Dukan Landour", "activity", 30.4628, 78.0794, "Landour", "Pancakes at Anil's, since 1947.", "mussoorie"),
        n("Cambridge Book Depot", "activity", 30.4595, 78.0646, "Mussoorie", "Met Ruskin Bond on Saturday!", "mussoorie"),
        n("Kempty Falls", "place", 30.4839, 78.0017, "Kempty", "Iconic falls — visit early to avoid crowd.", "mussoorie"),
     ]},
    {"cover": IMG["spiti"], "title": "Pin Valley Hidden Spiti",
     "description": "Off the beaten path — Mud village, Pin Valley NP.",
     "nodes": [
        n("Mud Village", "place", 32.0667, 78.0167, "Mud, Pin Valley", "Last village before Bhabha pass.", "spiti"),
        n("Pin Valley NP", "activity", 32.0500, 78.1167, "Pin Valley", "Snow leopard country.", "spiti"),
        n("Dhankar Monastery", "place", 32.0825, 78.2178, "Dhankar", "1000-yr cliffside monastery.", "spiti"),
        n("Tabo Caves", "place", 32.0950, 78.3833, "Tabo", "Ajanta of the Himalayas.", "spiti"),
     ]},
    {"cover": IMG["default"], "title": "Ranthambore Tiger Quest",
     "description": "3 safaris, 1 spotted, 1 missed — Ranthambore is patience.",
     "nodes": [
        n("Ranthambore Zone 3", "activity", 26.0173, 76.5026, "Ranthambore NP", "Spotted T-19 (Krishna).", "default"),
        n("Ranthambore Fort", "place", 26.0173, 76.4544, "Ranthambore", "1000-yr old fort inside the park.", "default"),
        n("Padam Talao", "place", 26.0250, 76.5050, "Ranthambore", "Lake popular with tigers in summer.", "default"),
     ]},
]


async def main():
    print("Wiping quests and non-admin users...")
    await db.quests.delete_many({})
    await db.users.delete_many({"role": {"$ne": "admin"}})

    user_ids = []
    for email, name, bio, password in USERS:
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid, "email": email.lower(), "name": name, "bio": bio,
            "avatar": "", "password_hash": hp(password),
            "created_at": now_iso(60), "role": "user",
        })
        user_ids.append(uid)
        print(f"  user: {email}")

    print(f"\nSeeding {len(QUESTS)} quests...")
    for i, q in enumerate(QUESTS):
        owner = user_ids[i % len(user_ids)]
        # random other users like the quest
        likers = random.sample([u for u in user_ids if u != owner], k=random.randint(0, 6))
        nodes_out = []
        for k, nd in enumerate(q["nodes"]):
            nodes_out.append({**nd, "id": str(uuid.uuid4()), "order": k})
        await db.quests.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": owner,
            "title": q["title"],
            "description": q["description"],
            "cover_photo_base64": q["cover"],  # URL stored in same field
            "nodes": nodes_out,
            "ai_summary": "",
            "likes": likers,
            "comments": [],
            "created_at": now_iso(random.randint(0, 30)),
        })
        print(f"  quest: {q['title']}  (owner #{i % len(user_ids) + 1}, {len(likers)} likes)")

    counts = {
        "users": await db.users.count_documents({}),
        "quests": await db.quests.count_documents({}),
    }
    print("\nDone.", counts)


if __name__ == "__main__":
    asyncio.run(main())
