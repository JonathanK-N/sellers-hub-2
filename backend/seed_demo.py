"""Demo seed v2 — boutiques complètes avec vraies images Unsplash.

Variables d'environnement:
  SEED_DEMO=1   active le seed au démarrage
  RESET_DB=1    efface TOUTES les données (sauf admin) avant de seeder

Idempotent: sans RESET_DB, skip si données démo déjà présentes.
"""
import os
import uuid
import random
import logging
from datetime import datetime, timezone, timedelta

from db import get_db
from auth import normalize_phone, hash_password

logger = logging.getLogger(__name__)
_DEMO_PWD = hash_password("demo1234")


def _now_iso(days_ago=0):
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()

def _uid(): return str(uuid.uuid4())

# ---------------------------------------------------------------------------
# Images Unsplash — URLs directes (libres de droits, pas de token requis)
# Format: https://images.unsplash.com/photo-<id>?w=800&q=80&fit=crop
# ---------------------------------------------------------------------------
def img(filename):
    """Images hébergées sur GitHub — accessibles sans restriction."""
    return f"https://raw.githubusercontent.com/JonathanK-N/sellers-hub-2/main/public/images/products/{filename}.jpg"

# Logos boutiques (carrés)
LOGO_ELECTRO   = img("logo_electro")
LOGO_MODE      = img("logo_mode")
LOGO_AGRI      = img("logo_agri")
LOGO_SOLAR     = img("logo_solar")
LOGO_MAISON    = img("logo_maison")

# Bannières boutiques (paysage)
BAN_ELECTRO    = img("logo_electro")
BAN_MODE       = img("logo_mode")
BAN_AGRI       = img("logo_agri")
BAN_SOLAR      = img("logo_solar")
BAN_MAISON     = img("logo_maison")

# ---------------------------------------------------------------------------
# BOUTIQUES avec leurs produits
# ---------------------------------------------------------------------------
SHOPS = [
  {
    "shop_name": "ÉlectroKin",
    "category": "Électronique",
    "description": "Spécialiste en téléphones, accessoires et électronique à Kinshasa. Garantie 3 mois sur tous nos produits.",
    "long_description": "Fondée en 2019 à Gombe, ÉlectroKin est la boutique de référence pour l'électronique grand public à Kinshasa. Nous proposons uniquement des produits vérifiés, avec une garantie de 3 mois pièces et main-d'œuvre. Notre équipe technique assure aussi la réparation et la maintenance de vos appareils. Nous collaborons directement avec des importateurs sérieux pour vous offrir les meilleurs prix du marché.",
    "neighborhood": "Gombe",
    "lat": -4.3017, "lng": 15.3136,
    "opening_hours": "08h00 – 19h00 (lun-sam)",
    "shop_logo_url": LOGO_ELECTRO,
    "shop_banner_url": BAN_ELECTRO,
    "specialties": ["Smartphones", "Accessoires", "Réparation", "Chargeurs"],
    "social_links": {"facebook": "https://facebook.com/electrokin", "whatsapp_business": "+243810000001"},
    "premium": True, "verified": True, "rating": 4.8,
    "products": [
      {
        "name": "Smartphone Android 128 Go",
        "description": "Téléphone double SIM, écran 6.5\", batterie 5000mAh, appareil photo 48MP.",
        "long_description": "Ce smartphone offre une expérience fluide avec son processeur octa-core et ses 4 Go de RAM. L'écran HD+ de 6,5 pouces est idéal pour les vidéos et les réseaux sociaux. La batterie de 5000mAh vous accompagne toute la journée. Livré avec chargeur, coque de protection et verre trempé. Garantie 3 mois en boutique.",
        "price": 285000, "stock": 14, "category": "Électronique",
        "photos": [
          img("ipad"),
          img("disque_dur"),
          img("moniteur_samsung"),
        ],
        "specs": [{"label":"Stockage","value":"128 Go"},{"label":"RAM","value":"4 Go"},{"label":"Batterie","value":"5000 mAh"},{"label":"Écran","value":"6.5 pouces HD+"}],
      },
      {
        "name": "Écouteurs Bluetooth sans fil",
        "description": "Écouteurs True Wireless, autonomie 20h avec boîtier de charge, réduction de bruit.",
        "long_description": "Ces écouteurs True Wireless offrent un son de qualité avec une réduction active du bruit. Le boîtier de charge compact vous permet d'avoir jusqu'à 20 heures d'autonomie totale. Résistants à la transpiration (IPX4), ils sont parfaits pour le sport. Connexion Bluetooth 5.0 stable jusqu'à 10 mètres.",
        "price": 35000, "stock": 40, "category": "Électronique",
        "photos": [
          img("echo_show"),
          img("ipad"),
        ],
        "specs": [{"label":"Autonomie","value":"20h (boîtier inclus)"},{"label":"Bluetooth","value":"5.0"},{"label":"Résistance","value":"IPX4"}],
      },
      {
        "name": "Chargeur rapide USB-C 65W",
        "description": "Charge rapide compatible tous téléphones et laptops USB-C. Câble inclus.",
        "long_description": "Ce chargeur universel 65W est compatible avec la quasi-totalité des smartphones, tablettes et laptops USB-C du marché. La technologie GaN (nitrure de gallium) le rend compact et moins chaud que les chargeurs traditionnels. Livré avec un câble USB-C tressé de 1,5 mètre.",
        "price": 22000, "stock": 55, "category": "Électronique",
        "photos": [img("disque_dur"), img("moniteur_samsung")],
        "specs": [{"label":"Puissance","value":"65W"},{"label":"Ports","value":"USB-C + USB-A"},{"label":"Câble","value":"Inclus 1.5m"}],
      },
      {
        "name": "Power Bank 20000mAh",
        "description": "Batterie externe ultra-capacité, 2 ports USB-A + 1 USB-C, charge rapide 22W.",
        "long_description": "Ce power bank de 20000mAh peut recharger votre téléphone plus de 4 fois complètement. Deux ports USB-A et un port USB-C vous permettent de charger jusqu'à 3 appareils simultanément. La charge rapide 22W est compatible avec les derniers smartphones. Indicateur LED de niveau de charge.",
        "price": 45000, "stock": 20, "category": "Électronique",
        "photos": [img("echo_show"), img("disque_dur")],
        "specs": [{"label":"Capacité","value":"20000 mAh"},{"label":"Charge rapide","value":"22W"},{"label":"Ports","value":"2×USB-A + 1×USB-C"}],
      },
    ],
  },
  {
    "shop_name": "ModeAfrique",
    "category": "Vêtements & Mode",
    "description": "Tissus wax authentiques, prêt-à-porter africain et accessoires de mode. Livraison dans tout Kinshasa.",
    "long_description": "ModeAfrique est née de la passion pour les tissus africains et le savoir-faire local. Nous proposons des pagnes wax de qualité supérieure importés directement du Ghana et de Côte d'Ivoire, ainsi que des créations confectionnées par nos couturières locales. Chaque pièce est unique et reflète la richesse de la mode africaine contemporaine. Nous proposons aussi des services de couture sur mesure.",
    "neighborhood": "Lingwala",
    "lat": -4.3300, "lng": 15.3050,
    "opening_hours": "09h00 – 18h00 (lun-sam)",
    "shop_logo_url": LOGO_MODE,
    "shop_banner_url": BAN_MODE,
    "specialties": ["Pagnes wax", "Couture sur mesure", "Accessoires", "Prêt-à-porter"],
    "social_links": {"facebook": "https://facebook.com/modeafrique.kin", "instagram": "https://instagram.com/modeafrique_kin", "whatsapp_business": "+243810000002"},
    "premium": False, "verified": True, "rating": 4.6,
    "products": [
      {
        "name": "Pagne wax hollandais 6 yards",
        "description": "Tissu wax 100% coton de qualité supérieure, certifié Ghana. Motifs exclusifs, couleurs vives.",
        "long_description": "Ce pagne wax hollandais est fabriqué avec du coton 100% certifié, teint à la cire véritable pour des couleurs durables qui ne déteindront pas au lavage. Le motif est exclusif à notre boutique pour cette saison. 6 yards suffisent pour une robe longue et une tête. Lavage à 30°C recommandé.",
        "price": 28000, "stock": 30, "category": "Vêtements",
        "photos": [
          img("tshirt_carhartt"),
          img("crocs"),
          img("soutien_gorge"),
        ],
        "specs": [{"label":"Longueur","value":"6 yards (5.5m)"},{"label":"Matière","value":"100% coton"},{"label":"Origine","value":"Ghana"},{"label":"Lavage","value":"30°C max"}],
      },
      {
        "name": "Robe africaine confectionnée",
        "description": "Robe longue en wax, coupe moderne, fabriquée localement par nos couturières. Toutes tailles.",
        "long_description": "Cette robe longue est confectionnée sur place par nos couturières expérimentées. La coupe moderne valorise toutes les morphologies. Le tissu wax utilisé est de qualité supérieure. Disponible en plusieurs tailles (S à 3XL) et en plusieurs coloris. Le délai de confection est de 5 à 7 jours ouvrables. Photos sur commande.",
        "price": 55000, "stock": 15, "category": "Vêtements",
        "photos": [
          img("tshirt_carhartt"),
          img("soutien_gorge"),
        ],
        "specs": [{"label":"Tailles","value":"S à 3XL"},{"label":"Délai","value":"5-7 jours"},{"label":"Tissu","value":"Wax premium"}],
      },
      {
        "name": "Sac à main artisanal wax",
        "description": "Sac fait main en tissu wax et cuir synthétique. Unique, original, 100% local.",
        "long_description": "Ce sac à main est entièrement fabriqué à la main par nos artisans locaux, combinant tissu wax africain et cuir synthétique de qualité. L'intérieur est doublé avec une poche zippée et deux poches latérales. La bandoulière est amovible et ajustable. Chaque sac est unique — aucun modèle identique n'est produit deux fois.",
        "price": 32000, "stock": 18, "category": "Maroquinerie",
        "photos": [
          img("crocs"),
          img("soutien_gorge"),
        ],
        "specs": [{"label":"Dimensions","value":"35×25×12 cm"},{"label":"Bandoulière","value":"Amovible, ajustable"},{"label":"Fabrication","value":"Artisanale locale"}],
      },
    ],
  },
  {
    "shop_name": "AgriMarché RDC",
    "category": "Alimentation & Agriculture",
    "description": "Produits agricoles frais et denrées alimentaires de base. Directement des producteurs locaux.",
    "long_description": "AgriMarché RDC est née d'une volonté de relier directement les producteurs du Bas-Congo et du Kasaï aux consommateurs de Kinshasa. En supprimant les intermédiaires, nous garantissons des produits plus frais à des prix plus justes pour tous. Nous travaillons avec plus de 50 familles d'agriculteurs partenaires certifiés. Commandes disponibles en gros et au détail.",
    "neighborhood": "Kalamu",
    "lat": -4.3500, "lng": 15.3000,
    "opening_hours": "06h00 – 17h00 (tous les jours)",
    "shop_logo_url": LOGO_AGRI,
    "shop_banner_url": BAN_AGRI,
    "specialties": ["Riz local", "Farine manioc", "Légumes frais", "Huile de palme"],
    "social_links": {"whatsapp_business": "+243810000003"},
    "premium": False, "verified": False, "rating": 4.3,
    "products": [
      {
        "name": "Riz local Bas-Congo 25 kg",
        "description": "Riz long grain cultivé au Bas-Congo, produit sans pesticides, sac de 25 kg.",
        "long_description": "Ce riz est cultivé par nos partenaires agriculteurs du Bas-Congo, selon des pratiques respectueuses de l'environnement. Il est décortiqué et nettoyé sur place avant emballage. Le riz long grain est idéal pour toutes les préparations : riz sauté, riz au gras, accompagnement de sauces. Conditionnement en sac tissé respirant de 25 kg.",
        "price": 52000, "stock": 45, "category": "Alimentation",
        "photos": [
          img("riz_basmati"),
          img("melange_riz"),
        ],
        "specs": [{"label":"Poids","value":"25 kg"},{"label":"Origine","value":"Bas-Congo"},{"label":"Grain","value":"Long grain"},{"label":"Traitement","value":"Sans pesticides"}],
      },
      {
        "name": "Huile de palme rouge 5 litres",
        "description": "Huile de palme rouge naturelle, pressée à froid, non raffinée. Riche en vitamines A et E.",
        "long_description": "Notre huile de palme rouge est extraite par pression à froid des régimes de palmiers sélectionnés. Non raffinée, elle conserve toutes ses propriétés nutritives, notamment sa richesse en bêta-carotène (vitamine A) et en vitamine E. Idéale pour la cuisine traditionnelle : sauces, fritures, ragouts. Conditionnée en bidon hermétique de 5 litres.",
        "price": 18000, "stock": 38, "category": "Alimentation",
        "photos": [img("melange_riz"), img("ventilateur")],
        "specs": [{"label":"Volume","value":"5 litres"},{"label":"Type","value":"Non raffinée"},{"label":"Extraction","value":"Pression à froid"}],
      },
      {
        "name": "Farine de manioc 10 kg",
        "description": "Farine de manioc finement moulue, pour fufu, chikwangue et autres préparations traditionnelles.",
        "long_description": "Cette farine de manioc est produite à partir de manioc doux soigneusement sélectionné, fermenté selon la méthode traditionnelle puis séché et moulu finement. Elle est idéale pour préparer le fufu, le chikwangue ou le bâton de manioc. Conditionnée en sac de 10 kg avec fermeture hermétique pour une meilleure conservation.",
        "price": 14000, "stock": 60, "category": "Alimentation",
        "photos": [img("riz_basmati"), img("melange_riz")],
        "specs": [{"label":"Poids","value":"10 kg"},{"label":"Type","value":"Manioc fermenté"},{"label":"Mouture","value":"Fine"}],
      },
      {
        "name": "Haricots rouges secs 5 kg",
        "description": "Haricots rouges sélectionnés, séchés naturellement. Protéines végétales de qualité.",
        "long_description": "Ces haricots rouges sont cultivés dans la région de Goma, connue pour la richesse de ses terres volcaniques. Triés à la main et séchés naturellement, ils sont exempts de cailloux et d'impuretés. Riches en protéines et en fibres, ils constituent un aliment de base essentiel. Temps de cuisson : environ 45 minutes après trempage de 8h.",
        "price": 16000, "stock": 40, "category": "Alimentation",
        "photos": [img("riz_basmati"), img("melange_riz")],
        "specs": [{"label":"Poids","value":"5 kg"},{"label":"Origine","value":"Région de Goma"},{"label":"Conservation","value":"12 mois à l'abri de l'humidité"}],
      },
    ],
  },
  {
    "shop_name": "SolarDRC",
    "category": "Énergie & Solaire",
    "description": "Solutions d'énergie solaire complètes pour foyers et entreprises. Installation et SAV assurés.",
    "long_description": "SolarDRC est votre partenaire énergétique en RDC. Face aux délestages fréquents, nous proposons des solutions solaires fiables et durables pour les foyers, les commerces et les entreprises. Nos équipes techniques certifiées assurent l'installation, la maintenance et la réparation de vos installations. Nous proposons des solutions de financement en partenariat avec des institutions de microfinance locales.",
    "neighborhood": "Ngaliema",
    "lat": -4.3700, "lng": 15.2500,
    "opening_hours": "08h00 – 17h30 (lun-ven) / 09h00 – 14h00 (sam)",
    "shop_logo_url": LOGO_SOLAR,
    "shop_banner_url": BAN_SOLAR,
    "specialties": ["Panneaux solaires", "Batteries", "Kits complets", "Installation"],
    "social_links": {"facebook": "https://facebook.com/solardrc", "whatsapp_business": "+243810000004"},
    "premium": True, "verified": True, "rating": 4.9,
    "products": [
      {
        "name": "Kit solaire complet 200W",
        "description": "Kit complet : panneau 200W + batterie 100Ah + régulateur MPPT + 4 ampoules LED + câblage.",
        "long_description": "Ce kit solaire complet est conçu pour alimenter un foyer de 4 à 6 personnes. Il inclut un panneau monocristallin de 200W, une batterie AGM de 100Ah (sans entretien), un régulateur de charge MPPT intelligent, 4 ampoules LED 9W, et tout le câblage nécessaire. L'installation est assurée par nos techniciens certifiés (dans un rayon de 30 km de Kinshasa). Autonomie de 2 jours sans soleil.",
        "price": 420000, "stock": 6, "category": "Énergie",
        "photos": [
          img("panneau_solaire_usb"),
          img("panneau_solaire_usb"),
          img("lampes_solaires"),
        ],
        "specs": [{"label":"Panneau","value":"200W monocristallin"},{"label":"Batterie","value":"100Ah AGM"},{"label":"Régulateur","value":"MPPT 20A"},{"label":"Installation","value":"Incluse (30km)"},{"label":"Garantie","value":"2 ans"}],
      },
      {
        "name": "Panneau solaire 100W",
        "description": "Panneau photovoltaïque monocristallin 100W, cadre aluminium anodisé, garantie 5 ans.",
        "long_description": "Ce panneau solaire monocristallin de 100W offre un excellent rendement même par temps nuageux. Son cadre en aluminium anodisé est conçu pour résister aux conditions climatiques tropicales. La vitre trempée anti-reflet maximise la captation lumineuse. Compatible avec tous les régulateurs MPPT et PWM du marché. Idéal pour les petites installations ou en complément d'un système existant.",
        "price": 195000, "stock": 12, "category": "Énergie",
        "photos": [img("lampes_solaires"), img("panneau_solaire_usb")],
        "specs": [{"label":"Puissance","value":"100W"},{"label":"Type","value":"Monocristallin"},{"label":"Garantie","value":"5 ans puissance"},{"label":"Dimensions","value":"1050×660×35 mm"}],
      },
      {
        "name": "Lampe solaire portable 30W",
        "description": "Lampe solaire rechargeable, autonomie 12h, avec panneau intégré et port USB de charge.",
        "long_description": "Cette lampe solaire tout-en-un est idéale comme éclairage de secours ou principal. Elle se recharge en 6 à 8 heures de soleil et offre jusqu'à 12 heures d'éclairage en mode économique. Le port USB intégré permet de charger un téléphone simultanément. Résistante à la pluie (IP44) et aux chocs. Légère et transportable, elle fonctionne aussi comme lampe torche.",
        "price": 32000, "stock": 30, "category": "Énergie",
        "photos": [img("disque_dur"), img("echo_show")],
        "specs": [{"label":"Autonomie","value":"12h (mode éco)"},{"label":"Recharge","value":"6-8h soleil"},{"label":"Port USB","value":"5V/2A"},{"label":"Résistance","value":"IP44"}],
      },
    ],
  },
  {
    "shop_name": "MaisonDéco Kin",
    "category": "Maison & Décoration",
    "description": "Tout pour votre maison : meubles, ustensiles, décoration et appareils électroménagers. Prix compétitifs.",
    "long_description": "MaisonDéco Kin est votre destination pour l'équipement et la décoration de votre intérieur à Kinshasa. Notre showroom de 200m² expose plus de 500 références soigneusement sélectionnées pour leur qualité et leur rapport qualité-prix. Nous proposons la livraison à domicile sur Kinshasa et ses environs, ainsi qu'un service de montage pour les meubles. Satisfait ou remboursé sous 7 jours.",
    "neighborhood": "Limete",
    "lat": -4.3600, "lng": 15.3600,
    "opening_hours": "09h00 – 18h00 (lun-sam) / 10h00 – 15h00 (dim)",
    "shop_logo_url": LOGO_MAISON,
    "shop_banner_url": BAN_MAISON,
    "specialties": ["Électroménager", "Ustensiles", "Décoration", "Mobilier"],
    "social_links": {"facebook": "https://facebook.com/maisondeco.kin", "instagram": "https://instagram.com/maisondeco_kin", "whatsapp_business": "+243810000005"},
    "premium": False, "verified": True, "rating": 4.4,
    "products": [
      {
        "name": "Ventilateur sur pied 16 pouces",
        "description": "Ventilateur sur pied 3 vitesses, oscillation automatique, silencieux, télécommande incluse.",
        "long_description": "Ce ventilateur sur pied de 16 pouces est idéal pour lutter contre la chaleur kinoise. Avec ses 3 vitesses réglables et son oscillation à 90°, il distribue l'air frais dans toute la pièce. La télécommande vous permet de le contrôler sans vous lever. Son moteur à faible consommation (45W) est particulièrement économique. Pied stable et antidérapant, démontable pour un rangement facile.",
        "price": 65000, "stock": 18, "category": "Électroménager",
        "photos": [
          img("ventilateur"),
          img("1558618666-fcd25c85cd64"),
        ],
        "specs": [{"label":"Diamètre","value":"16 pouces (40 cm)"},{"label":"Vitesses","value":"3"},{"label":"Consommation","value":"45W"},{"label":"Télécommande","value":"Incluse"}],
      },
      {
        "name": "Set de casseroles inox 6 pièces",
        "description": "Ensemble 6 casseroles en acier inoxydable 304, fond épais, poignées ergonomiques, tous feux.",
        "long_description": "Ce set de 6 casseroles en inox 304 (qualité alimentaire) comprend 3 casseroles (16/18/20 cm) et 3 marmites (22/24/26 cm), toutes avec couvercles. Le fond triple épaisseur garantit une diffusion homogène de la chaleur et une résistance durable. Compatible tous feux (gaz, électrique, induction). Passe au lave-vaisselle. La qualité professionnelle à prix accessible.",
        "price": 78000, "stock": 12, "category": "Cuisine",
        "photos": [img("ventilateur"), img("casseroles")],
        "specs": [{"label":"Nombre","value":"6 pièces + 6 couvercles"},{"label":"Matière","value":"Inox 304"},{"label":"Compatibilité","value":"Tous feux + induction"},{"label":"Lave-vaisselle","value":"Oui"}],
      },
      {
        "name": "Lot de 6 assiettes en verre trempé",
        "description": "Assiettes plates en verre trempé, résistantes aux chocs et à la chaleur, design élégant.",
        "long_description": "Ces assiettes en verre trempé allient élégance et résistance. Le verre trempé est 5 fois plus résistant que le verre ordinaire et supporte des températures jusqu'à 150°C. Leur design sobre et contemporain s'adapte à toutes les tables. Idéales pour le quotidien comme pour les occasions spéciales. Empilables pour un rangement optimisé.",
        "price": 18000, "stock": 35, "category": "Art de la table",
        "photos": [img("casseroles"), img("ventilateur")],
        "specs": [{"label":"Nombre","value":"6 assiettes"},{"label":"Matière","value":"Verre trempé"},{"label":"Résistance","value":"Jusqu'à 150°C"},{"label":"Diamètre","value":"26 cm"}],
      },
      {
        "name": "Miroir mural décoratif 60×80 cm",
        "description": "Miroir avec cadre en bois naturel, design africain, livré avec fixations incluses.",
        "long_description": "Ce miroir mural est encadré d'un bois naturel sculpté selon des motifs africains traditionnels. Sa taille généreuse (60×80 cm) en fait un élément décoratif fort pour votre salon, entrée ou chambre. Le verre argent de haute qualité offre un reflet fidèle sans distorsion. Les fixations murales sont incluses. Fabriqué par des artisans congolais.",
        "price": 45000, "stock": 10, "category": "Décoration",
        "photos": [img("1558618666-fcd25c85cd64"), img("casseroles")],
        "specs": [{"label":"Dimensions","value":"60×80 cm"},{"label":"Cadre","value":"Bois naturel sculpté"},{"label":"Fixations","value":"Incluses"},{"label":"Fabrication","value":"Artisanale locale"}],
      },
    ],
  },
]

# Acheteurs de démo
BUYERS = [
    ("Béatrice Mutombo", "+243821111001"),
    ("Patrick Luzolo", "+243821111002"),
    ("Marie-Claire Ngalula", "+243821111003"),
    ("Djuma Kasongo", "+243821111004"),
    ("Astrid Nkosi", "+243821111005"),
]

# Livreurs
DELIVERERS = [
    ("Moïse Kabongo", "+243831000001"),
    ("Christophe Malanda", "+243831000002"),
]

REVIEWS_POOL = [
    (5, "Excellent produit ! Conforme à la description, je recommande vivement cette boutique."),
    (5, "Livraison rapide et produit impeccable. Je reviendrai certainement."),
    (4, "Très bon rapport qualité-prix. Vendeur sérieux et réactif."),
    (4, "Produit conforme. Petit délai de livraison mais qualité au rendez-vous."),
    (5, "Je suis bluffé par la qualité ! Exactement ce que je cherchais."),
    (4, "Bon produit, emballage soigné. Je recommande."),
    (3, "Produit correct mais légèrement différent des photos. Service client sympathique."),
    (5, "Parfait ! Ma commande est arrivée en moins de 24h. Boutique de confiance."),
]


async def reset_db():
    """Efface toutes les données sauf l'admin."""
    db = get_db()
    admin = await db.users.find_one({"role": "admin"})
    admin_id = admin["id"] if admin else None
    colls = [
        "users", "sellers", "products", "orders", "order_groups", "transactions",
        "reviews", "disputes", "messages", "notifications", "otp_codes",
        "premium_subscriptions", "deliverers", "withdrawals",
    ]
    for c in colls:
        await db[c].delete_many({"id": {"$ne": admin_id}} if c == "users" else {})
    logger.info("Base de données réinitialisée (admin conservé)")


async def _refresh_product_images(db):
    """Met à jour les photos manquantes des produits de démo.
    Stratégie: par nom exact d'abord, puis par catégorie si aucun match.
    Met aussi à jour logos/bannières des sellers.
    """
    # Index nom -> données produit
    product_by_name = {}
    # Index catégorie -> liste d'images disponibles
    images_by_category = {}

    for shop in SHOPS:
        # Mise à jour sellers (logo + bannière + description)
        await db.sellers.update_one(
            {"shop_name": shop["shop_name"], "demo": True},
            {"$set": {
                "shop_logo_url": shop.get("shop_logo_url"),
                "shop_banner_url": shop.get("shop_banner_url"),
                "long_description": shop.get("long_description", ""),
                "product_specialties": shop.get("specialties", []),
                "social_links": shop.get("social_links", {}),
            }}
        )
        for p in shop["products"]:
            photos = p.get("photos", [])
            product_by_name[p["name"]] = photos
            cat = p.get("category", shop["category"])
            if cat not in images_by_category:
                images_by_category[cat] = []
            images_by_category[cat].extend(photos)

    # Fallback: pool d'images par catégorie parente
    cat_fallbacks = {
        "Électronique": images_by_category.get("Électronique", []),
        "Vêtements": images_by_category.get("Vêtements", []) + images_by_category.get("Maroquinerie", []),
        "Alimentation": images_by_category.get("Alimentation", []),
        "Énergie": images_by_category.get("Énergie", []),
        "Maison": images_by_category.get("Maison", []) + images_by_category.get("Cuisine", []) + images_by_category.get("Art de la table", []) + images_by_category.get("Décoration", []),
    }

    import random
    updated = 0
    async for prod in db.products.find({"demo": True}):
        photos_raw = prod.get("photos", [])
        # Remplacer si: vide, null, /api/files/, Unsplash (403), Picsum (403) ou toute URL non-GitHub
        valid_photos = [
            p for p in photos_raw
            if p and isinstance(p, str)
            and "raw.githubusercontent.com" in p
            and "sellers-hub-2" in p
        ]
        if valid_photos:
            continue  # déjà de vraies photos Unsplash, on ne touche pas
        name = prod.get("name", "")
        cat = prod.get("category", "")

        # 1. Match exact par nom
        photos = product_by_name.get(name)

        # 2. Match partiel par nom (sous-chaîne)
        if not photos:
            for seed_name, seed_photos in product_by_name.items():
                key = seed_name.lower().split()[0]  # premier mot
                if key in name.lower() and seed_photos:
                    photos = seed_photos
                    break

        # 3. Fallback par catégorie
        if not photos:
            for cat_key, pool in cat_fallbacks.items():
                if cat_key.lower() in cat.lower() and pool:
                    photos = random.sample(pool, min(2, len(pool)))
                    break

        # 4. Fallback universel
        if not photos:
            all_photos = [p for photos_list in product_by_name.values() for p in photos_list]
            if all_photos:
                photos = random.sample(all_photos, min(2, len(all_photos)))

        if photos:
            await db.products.update_one(
                {"id": prod["id"]},
                {"$set": {"photos": photos}}
            )
            updated += 1
            logger.info(f"Images mises à jour: {name[:40]}")

    logger.info(f"Total images refresh: {updated} produits")



    db = get_db()

    # Reset si demandé
async def seed_demo():
    db = get_db()

    # Reset complet si demandé
    if os.environ.get("RESET_DB") == "1":
        await reset_db()

    # Si les données démo existent déjà, on met à jour les images/descriptions
    # des produits sans tout recréer (fix pour les anciens seeds sans images)
    if await db.sellers.count_documents({"demo": True}) > 0:
        logger.info("Demo data present — mise à jour des images produits...")
        await _refresh_product_images(db)
        return {"refreshed": True}


    created = {"sellers": 0, "products": 0, "buyers": 0, "orders": 0, "reviews": 0, "deliverers": 0}
    all_products = []

    KIN = [
        ("Gombe", -4.3017, 15.3136),
        ("Lingwala", -4.3300, 15.3050),
        ("Kalamu", -4.3500, 15.3000),
        ("Ngaliema", -4.3700, 15.2500),
        ("Limete", -4.3600, 15.3600),
    ]

    # --- Sellers + produits ---
    for i, s in enumerate(SHOPS):
        user_id = _uid()
        seller_id = _uid()
        phone = normalize_phone(f"+24381020{i:04d}")
        await db.users.insert_one({
            "id": user_id, "name": f"Gérant {s['shop_name']}", "phone": phone,
            "role": "seller", "country_code": "CD", "currency": "FC",
            "kyc_level": 2 if s["verified"] else 1, "password_hash": _DEMO_PWD,
            "phone_verified": True, "created_at": _now_iso(60 - i), "demo": True,
        })
        nbhd, lat, lng = KIN[i], s.get("lat", KIN[i][1]), s.get("lng", KIN[i][2])
        nbhd_name = s.get("neighborhood", KIN[i][0])
        premium_exp = _now_iso(-25) if s["premium"] else None
        await db.sellers.insert_one({
            "id": seller_id, "user_id": user_id,
            "shop_name": s["shop_name"], "description": s["description"],
            "long_description": s["long_description"],
            "category": s["category"],
            "product_specialties": s.get("specialties", []),
            "address": f"Av. Principale, {nbhd_name}", "neighborhood": nbhd_name,
            "opening_hours": s.get("opening_hours", "08h00-18h00"),
            "shop_logo_url": s.get("shop_logo_url"),
            "shop_banner_url": s.get("shop_banner_url"),
            "social_links": s.get("social_links", {}),
            "country_code": "CD", "kyc_status": "level3" if s["verified"] else "level1",
            "badge_verified": s["verified"], "rating": s["rating"],
            "commission_rate": 0.07,
            "premium": s["premium"], "premium_expires_at": premium_exp,
            "premium_since": _now_iso(5) if s["premium"] else None,
            "location": {"type": "Point", "coordinates": [s.get("lng", 15.31), s.get("lat", -4.32)]},
            "created_at": _now_iso(60 - i), "demo": True,
        })
        created["sellers"] += 1

        for p in s["products"]:
            pid = _uid()
            await db.products.insert_one({
                "id": pid, "seller_id": seller_id,
                "name": p["name"], "description": p["description"],
                "long_description": p.get("long_description", ""),
                "specs": p.get("specs", []),
                "price": p["price"], "currency": "FC",
                "stock": p["stock"], "category": p.get("category", s["category"]),
                "photos": p.get("photos", []),
                "is_active": True, "country_code": "CD",
                "created_at": _now_iso(random.randint(1, 40)), "demo": True,
            })
            created["products"] += 1
            all_products.append({"id": pid, "seller_id": seller_id, "name": p["name"], "price": p["price"]})

    # --- Acheteurs ---
    buyer_ids = []
    for name, phone in BUYERS:
        bid = _uid()
        await db.users.insert_one({
            "id": bid, "name": name, "phone": normalize_phone(phone),
            "role": "buyer", "country_code": "CD", "currency": "FC",
            "kyc_level": 1, "password_hash": _DEMO_PWD, "phone_verified": True,
            "created_at": _now_iso(random.randint(5, 50)), "demo": True,
        })
        buyer_ids.append(bid)
        created["buyers"] += 1

    # --- Livreurs ---
    for j, (name, phone) in enumerate(DELIVERERS):
        did = _uid()
        await db.users.insert_one({
            "id": did, "name": name, "phone": normalize_phone(phone),
            "role": "deliverer", "country_code": "CD", "currency": "FC",
            "password_hash": _DEMO_PWD, "phone_verified": True,
            "created_at": _now_iso(30), "demo": True,
        })
        await db.deliverers.insert_one({
            "id": _uid(), "user_id": did, "vehicle": "moto",
            "is_active": True, "country_code": "CD", "created_at": _now_iso(30), "demo": True,
        })
        created["deliverers"] += 1

    # --- Commandes + avis ---
    statuses = ["delivered", "delivered", "delivered", "out_for_delivery", "preparing", "confirmed"]
    for n in range(15):
        buyer = random.choice(buyer_ids)
        prod = random.choice(all_products)
        qty = random.randint(1, 2)
        total = prod["price"] * qty
        status = statuses[n % len(statuses)]
        escrow = "released" if status == "delivered" else "held"
        oid = _uid(); gid = _uid()
        days = random.randint(0, 25)
        await db.orders.insert_one({
            "id": oid, "order_group_id": gid, "buyer_id": buyer,
            "seller_id": prod["seller_id"],
            "items": [{"product_id": prod["id"], "name": prod["name"], "price": prod["price"], "quantity": qty, "subtotal": total}],
            "total_amount": total, "commission_amount": round(total * 0.07, 2), "currency": "FC",
            "delivery_mode": "delivery", "delivery_neighborhood": random.choice(KIN)[0],
            "status": status, "escrow_status": escrow,
            "confirmation_code": f"{random.randint(0,999999):06d}",
            "country_code": "CD", "created_at": _now_iso(days),
            "timeline": [{"status": "confirmed", "label": "Commande confirmée", "timestamp": _now_iso(days)}],
            "demo": True,
        })
        await db.order_groups.insert_one({
            "id": gid, "buyer_id": buyer, "order_ids": [oid], "seller_count": 1,
            "grand_total": total, "currency": "FC", "country_code": "CD",
            "created_at": _now_iso(days), "demo": True,
        })
        created["orders"] += 1
        if status == "delivered" and random.random() > 0.25:
            rating, comment = random.choice(REVIEWS_POOL)
            await db.reviews.insert_one({
                "id": _uid(), "order_id": oid, "buyer_id": buyer,
                "seller_id": prod["seller_id"], "rating": rating,
                "comment": comment, "created_at": _now_iso(max(0, days-1)), "demo": True,
            })
            created["reviews"] += 1

    logger.info(f"Demo seed v2 done: {created}")
    return created


if __name__ == "__main__":
    import asyncio, sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_demo())
