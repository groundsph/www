// Philippines Location Data
// Simplified structure with major regions, provinces, and cities

export interface LocationData {
    regions: Region[];
}

export interface Region {
    name: string;
    provinces: Province[];
}

export interface Province {
    name: string;
    cities: string[];
}

export const PHILIPPINES_LOCATIONS: LocationData = {
    regions: [
        {
            name: "NCR - National Capital Region",
            provinces: [
                {
                    name: "Metro Manila",
                    cities: [
                        "Caloocan", "Las Piñas", "Makati", "Malabon", "Mandaluyong",
                        "Manila", "Marikina", "Muntinlupa", "Navotas", "Parañaque",
                        "Pasay", "Pasig", "Pateros", "Quezon City", "San Juan",
                        "Taguig", "Valenzuela"
                    ]
                }
            ]
        },
        {
            name: "Region I - Ilocos Region",
            provinces: [
                {
                    name: "Ilocos Norte",
                    cities: ["Laoag", "Batac", "Paoay", "Pagudpud", "San Nicolas"]
                },
                {
                    name: "Ilocos Sur",
                    cities: ["Vigan", "Candon", "Narvacan", "Santa Maria", "Bantay"]
                },
                {
                    name: "La Union",
                    cities: ["San Fernando", "Bauang", "San Juan", "Agoo", "Rosario"]
                },
                {
                    name: "Pangasinan",
                    cities: ["Dagupan", "Alaminos", "San Carlos", "Urdaneta", "Lingayen", "Mangaldan"]
                }
            ]
        },
        {
            name: "Region II - Cagayan Valley",
            provinces: [
                {
                    name: "Batanes",
                    cities: ["Basco", "Itbayat", "Ivana", "Mahatao", "Sabtang", "Uyugan"]
                },
                {
                    name: "Cagayan",
                    cities: ["Tuguegarao", "Aparri", "Sanchez Mira", "Lal-lo", "Peñablanca"]
                },
                {
                    name: "Isabela",
                    cities: ["Ilagan", "Cauayan", "Santiago", "Roxas", "Tumauini"]
                },
                {
                    name: "Nueva Vizcaya",
                    cities: ["Bayombong", "Solano", "Bambang", "Bagabag", "Kayapa"]
                },
                {
                    name: "Quirino",
                    cities: ["Cabarroguis", "Diffun", "Maddela", "Saguday", "Nagtipunan"]
                }
            ]
        },
        {
            name: "Region III - Central Luzon",
            provinces: [
                {
                    name: "Aurora",
                    cities: ["Baler", "Casiguran", "Dilasag", "Dinalungan", "Maria Aurora"]
                },
                {
                    name: "Bataan",
                    cities: ["Balanga", "Dinalupihan", "Hermosa", "Mariveles", "Orani"]
                },
                {
                    name: "Bulacan",
                    cities: ["Malolos", "Meycauayan", "San Jose del Monte", "Marilao", "Bocaue", "Balagtas"]
                },
                {
                    name: "Nueva Ecija",
                    cities: ["Cabanatuan", "Palayan", "San Jose", "Gapan", "Muñoz"]
                },
                {
                    name: "Pampanga",
                    cities: ["San Fernando", "Angeles", "Mabalacat", "Guagua", "Porac", "Clark"]
                },
                {
                    name: "Tarlac",
                    cities: ["Tarlac City", "Paniqui", "Concepcion", "Capas", "Gerona"]
                },
                {
                    name: "Zambales",
                    cities: ["Olongapo", "Iba", "Subic", "San Antonio", "Castillejos"]
                }
            ]
        },
        {
            name: "Region IV-A - CALABARZON",
            provinces: [
                {
                    name: "Batangas",
                    cities: ["Batangas City", "Lipa", "Tanauan", "Santo Tomas", "Nasugbu", "Tagaytay"]
                },
                {
                    name: "Cavite",
                    cities: ["Cavite City", "Tagaytay", "Bacoor", "Imus", "Dasmariñas", "General Trias", "Silang"]
                },
                {
                    name: "Laguna",
                    cities: ["Santa Rosa", "Calamba", "San Pablo", "Biñan", "Los Baños", "San Pedro"]
                },
                {
                    name: "Quezon",
                    cities: ["Lucena", "Tayabas", "Sariaya", "Candelaria", "Pagbilao"]
                },
                {
                    name: "Rizal",
                    cities: ["Antipolo", "Cainta", "Taytay", "Angono", "Binangonan", "Rodriguez"]
                }
            ]
        },
        {
            name: "Region IV-B - MIMAROPA",
            provinces: [
                {
                    name: "Marinduque",
                    cities: ["Boac", "Gasan", "Mogpog", "Santa Cruz", "Torrijos"]
                },
                {
                    name: "Occidental Mindoro",
                    cities: ["Mamburao", "San Jose", "Sablayan", "Abra de Ilog", "Calintaan"]
                },
                {
                    name: "Oriental Mindoro",
                    cities: ["Calapan", "Puerto Galera", "Naujan", "Victoria", "Pinamalayan"]
                },
                {
                    name: "Palawan",
                    cities: ["Puerto Princesa", "El Nido", "Coron", "San Vicente", "Roxas"]
                },
                {
                    name: "Romblon",
                    cities: ["Romblon", "Odiongan", "Looc", "Santa Fe", "Cajidiocan"]
                }
            ]
        },
        {
            name: "Region V - Bicol Region",
            provinces: [
                {
                    name: "Albay",
                    cities: ["Legazpi", "Tabaco", "Ligao", "Daraga", "Guinobatan"]
                },
                {
                    name: "Camarines Norte",
                    cities: ["Daet", "Labo", "Vinzons", "Mercedes", "Paracale"]
                },
                {
                    name: "Camarines Sur",
                    cities: ["Naga", "Iriga", "Pili", "Camaligan", "Goa"]
                },
                {
                    name: "Catanduanes",
                    cities: ["Virac", "San Andres", "Bato", "Baras", "Gigmoto"]
                },
                {
                    name: "Masbate",
                    cities: ["Masbate City", "Aroroy", "Mandaon", "Mobo", "Cataingan"]
                },
                {
                    name: "Sorsogon",
                    cities: ["Sorsogon City", "Bulan", "Gubat", "Irosin", "Donsol"]
                }
            ]
        },
        {
            name: "Region VI - Western Visayas",
            provinces: [
                {
                    name: "Aklan",
                    cities: ["Kalibo", "Malay (Boracay)", "Banga", "Numancia", "Altavas"]
                },
                {
                    name: "Antique",
                    cities: ["San Jose de Buenavista", "Sibalom", "Culasi", "Pandan", "Tibiao"]
                },
                {
                    name: "Capiz",
                    cities: ["Roxas City", "Panay", "Pontevedra", "Panitan", "Dao"]
                },
                {
                    name: "Guimaras",
                    cities: ["Jordan", "Buenavista", "Nueva Valencia", "San Lorenzo", "Sibunag"]
                },
                {
                    name: "Iloilo",
                    cities: ["Iloilo City", "Passi", "Oton", "Pavia", "Santa Barbara", "Leganes"]
                },
                {
                    name: "Negros Occidental",
                    cities: ["Bacolod", "Silay", "Talisay", "Victorias", "Cadiz", "Sagay"]
                }
            ]
        },
        {
            name: "Region VII - Central Visayas",
            provinces: [
                {
                    name: "Bohol",
                    cities: ["Tagbilaran", "Panglao", "Dauis", "Loboc", "Carmen", "Anda"]
                },
                {
                    name: "Cebu",
                    cities: [
                        "Cebu City", "Mandaue", "Lapu-Lapu", "Talisay", "Naga",
                        "Carcar", "Danao", "Toledo", "Bogo", "Moalboal", "Oslob",
                        "Consolacion", "Liloan", "Minglanilla", "San Fernando"
                    ]
                },
                {
                    name: "Negros Oriental",
                    cities: ["Dumaguete", "Bais", "Bayawan", "Tanjay", "Canlaon"]
                },
                {
                    name: "Siquijor",
                    cities: ["Siquijor", "Larena", "San Juan", "Lazi", "Maria"]
                }
            ]
        },
        {
            name: "Region VIII - Eastern Visayas",
            provinces: [
                {
                    name: "Biliran",
                    cities: ["Naval", "Biliran", "Caibiran", "Culaba", "Kawayan"]
                },
                {
                    name: "Eastern Samar",
                    cities: ["Borongan", "Guiuan", "Oras", "Dolores", "Balangkayan"]
                },
                {
                    name: "Leyte",
                    cities: ["Tacloban", "Ormoc", "Palo", "Tanauan", "Baybay"]
                },
                {
                    name: "Northern Samar",
                    cities: ["Catarman", "Laoang", "Allen", "San Roque", "Palapag"]
                },
                {
                    name: "Samar",
                    cities: ["Catbalogan", "Calbayog", "Santa Rita", "Villareal", "Paranas"]
                },
                {
                    name: "Southern Leyte",
                    cities: ["Maasin", "Sogod", "Malitbog", "Bontoc", "Tomas Oppus"]
                }
            ]
        },
        {
            name: "Region IX - Zamboanga Peninsula",
            provinces: [
                {
                    name: "Zamboanga del Norte",
                    cities: ["Dipolog", "Dapitan", "Sindangan", "Liloy", "Rizal"]
                },
                {
                    name: "Zamboanga del Sur",
                    cities: ["Pagadian", "Zamboanga City", "Molave", "Aurora", "Dumalinao"]
                },
                {
                    name: "Zamboanga Sibugay",
                    cities: ["Ipil", "Kabasalan", "Siay", "Buug", "Diplahan"]
                }
            ]
        },
        {
            name: "Region X - Northern Mindanao",
            provinces: [
                {
                    name: "Bukidnon",
                    cities: ["Malaybalay", "Valencia", "Maramag", "Quezon", "Don Carlos"]
                },
                {
                    name: "Camiguin",
                    cities: ["Mambajao", "Catarman", "Guinsiliban", "Mahinog", "Sagay"]
                },
                {
                    name: "Lanao del Norte",
                    cities: ["Iligan", "Tubod", "Kapatagan", "Lala", "Kolambugan"]
                },
                {
                    name: "Misamis Occidental",
                    cities: ["Oroquieta", "Ozamiz", "Tangub", "Jimenez", "Plaridel"]
                },
                {
                    name: "Misamis Oriental",
                    cities: ["Cagayan de Oro", "Gingoog", "El Salvador", "Villanueva", "Jasaan"]
                }
            ]
        },
        {
            name: "Region XI - Davao Region",
            provinces: [
                {
                    name: "Davao de Oro",
                    cities: ["Nabunturan", "Pantukan", "Monkayo", "Compostela", "New Bataan"]
                },
                {
                    name: "Davao del Norte",
                    cities: ["Tagum", "Panabo", "Samal", "Carmen", "Kapalong"]
                },
                {
                    name: "Davao del Sur",
                    cities: ["Davao City", "Digos", "Bansalan", "Hagonoy", "Santa Cruz"]
                },
                {
                    name: "Davao Occidental",
                    cities: ["Malita", "Santa Maria", "Don Marcelino", "Jose Abad Santos", "Sarangani"]
                },
                {
                    name: "Davao Oriental",
                    cities: ["Mati", "Baganga", "Cateel", "Boston", "San Isidro"]
                }
            ]
        },
        {
            name: "Region XII - SOCCSKSARGEN",
            provinces: [
                {
                    name: "Cotabato",
                    cities: ["Kidapawan", "Matalam", "Kabacan", "M'lang", "Tulunan"]
                },
                {
                    name: "Sarangani",
                    cities: ["Alabel", "General Santos", "Glan", "Malapatan", "Maasim"]
                },
                {
                    name: "South Cotabato",
                    cities: ["Koronadal", "General Santos", "Polomolok", "Tupi", "Tampakan"]
                },
                {
                    name: "Sultan Kudarat",
                    cities: ["Isulan", "Tacurong", "Lambayong", "Kalamansig", "Esperanza"]
                }
            ]
        },
        {
            name: "Region XIII - Caraga",
            provinces: [
                {
                    name: "Agusan del Norte",
                    cities: ["Butuan", "Cabadbaran", "Buenavista", "Nasipit", "Las Nieves"]
                },
                {
                    name: "Agusan del Sur",
                    cities: ["Bayugan", "Prosperidad", "San Francisco", "Bunawan", "Trento"]
                },
                {
                    name: "Dinagat Islands",
                    cities: ["San Jose", "Basilisa", "Cagdianao", "Dinagat", "Libjo"]
                },
                {
                    name: "Surigao del Norte",
                    cities: ["Surigao City", "Dapa", "Del Carmen", "San Isidro", "Pilar"]
                },
                {
                    name: "Surigao del Sur",
                    cities: ["Tandag", "Bislig", "Lianga", "Cagwait", "Marihatag"]
                }
            ]
        },
        {
            name: "BARMM - Bangsamoro",
            provinces: [
                {
                    name: "Basilan",
                    cities: ["Isabela City", "Lamitan", "Tipo-Tipo", "Tuburan", "Sumisip"]
                },
                {
                    name: "Lanao del Sur",
                    cities: ["Marawi", "Wao", "Malabang", "Masiu", "Binidayan"]
                },
                {
                    name: "Maguindanao del Norte",
                    cities: ["Datu Odin Sinsuat", "Sultan Kudarat", "Upi", "Northern Kabuntalan", "Barira"]
                },
                {
                    name: "Maguindanao del Sur",
                    cities: ["Buluan", "General S. K. Pendatun", "Datu Paglas", "Datu Piang", "Shariff Aguak"]
                },
                {
                    name: "Sulu",
                    cities: ["Jolo", "Patikul", "Indanan", "Talipao", "Parang"]
                },
                {
                    name: "Tawi-Tawi",
                    cities: ["Bongao", "Panglima Sugala", "Sitangkai", "Simunul", "Turtle Islands"]
                }
            ]
        },
        {
            name: "CAR - Cordillera Administrative Region",
            provinces: [
                {
                    name: "Abra",
                    cities: ["Bangued", "Lagangilang", "Tayum", "Dolores", "Pilar"]
                },
                {
                    name: "Apayao",
                    cities: ["Kabugao", "Luna", "Pudtol", "Flora", "Conner"]
                },
                {
                    name: "Benguet",
                    cities: ["Baguio", "La Trinidad", "Itogon", "Tuba", "Tublay"]
                },
                {
                    name: "Ifugao",
                    cities: ["Lagawe", "Banaue", "Kiangan", "Hungduan", "Mayoyao"]
                },
                {
                    name: "Kalinga",
                    cities: ["Tabuk", "Tinglayan", "Balbalan", "Lubuagan", "Rizal"]
                },
                {
                    name: "Mountain Province",
                    cities: ["Bontoc", "Sagada", "Bauko", "Besao", "Sabangan"]
                }
            ]
        }
    ]
};

// Helper function to get provinces for a region
export function getProvincesForRegion(regionName: string): Province[] {
    const region = PHILIPPINES_LOCATIONS.regions.find(r => r.name === regionName);
    return region?.provinces || [];
}

// Helper function to get cities for a province
export function getCitiesForProvince(regionName: string, provinceName: string): string[] {
    const region = PHILIPPINES_LOCATIONS.regions.find(r => r.name === regionName);
    const province = region?.provinces.find(p => p.name === provinceName);
    return province?.cities || [];
}

// Basic vibe tags - users can add more via text input
export const CAFE_VIBE_TAGS = [
    "cozy", "minimalist", "modern", "quiet", "lively", "instagram_worthy"
];

// Basic specialty options - users can add more via text input
export const CAFE_SPECIALTIES = [
    "specialty_coffee", "pastries", "brunch", "matcha", "vegan_options"
];

// Common brew methods
export const BREW_METHODS = [
    "Espresso", "Pour Over", "French Press", "Aeropress", "Cold Brew",
    "Chemex", "V60", "Siphon", "Moka Pot", "Drip Coffee"
];

// Payment method options
export const PAYMENT_METHODS = [
    "cash", "gcash", "maya", "credit_card", "debit_card", "bank_transfer"
];
