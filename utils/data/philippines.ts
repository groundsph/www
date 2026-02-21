// Philippines Location Data
// Complete listing of all regions, provinces, and cities/municipalities
// Source: Philippine Standard Geographic Code (PSGC) - PSA
// Last updated: December 2024

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
                    cities: [
                        "Adams", "Bacarra", "Badoc", "Bangui", "Banna (Espiritu)",
                        "Batac City", "Burgos", "Carasi", "Currimao", "Dingras",
                        "Dumalneg", "Laoag City", "Marcos", "Nueva Era", "Pagudpud",
                        "Paoay", "Pasuquin", "Piddig", "Pinili", "San Nicolas",
                        "Sarrat", "Solsona", "Vintar"
                    ]
                },
                {
                    name: "Ilocos Sur",
                    cities: [
                        "Alilem", "Banayoyo", "Bantay", "Burgos", "Cabugao",
                        "Candon City", "Caoayan", "Cervantes", "Galimuyod", "Gregorio del Pilar (Concepcion)",
                        "Lidlidda", "Magsingal", "Nagbukel", "Narvacan", "Quirino (Angkaki)",
                        "Salcedo (Baugen)", "San Emilio", "San Esteban", "San Ildefonso", "San Juan (Lapog)",
                        "San Vicente", "Santa", "Santa Catalina", "Santa Cruz", "Santa Lucia",
                        "Santa Maria", "Santiago", "Santo Domingo", "Sigay", "Sinait",
                        "Sugpon", "Suyo", "Tagudin", "Vigan City"
                    ]
                },
                {
                    name: "La Union",
                    cities: [
                        "Agoo", "Aringay", "Bacnotan", "Bagulin", "Balaoan",
                        "Bangar", "Bauang", "Burgos", "Caba", "Luna",
                        "Naguilian", "Pugo", "Rosario", "San Fernando City", "San Gabriel",
                        "San Juan", "Santo Tomas", "Santol", "Sudipen", "Tubao"
                    ]
                },
                {
                    name: "Pangasinan",
                    cities: [
                        "Agno", "Aguilar", "Alaminos City", "Alcala", "Anda",
                        "Asingan", "Balungao", "Bani", "Basista", "Bautista",
                        "Bayambang", "Binalonan", "Binmaley", "Bolinao", "Bugallon",
                        "Burgos", "Calasiao", "Dagupan City", "Dasol", "Infanta",
                        "Labrador", "Laoac", "Lingayen", "Mabini", "Malasiqui",
                        "Manaoag", "Mangaldan", "Mangatarem", "Mapandan", "Natividad",
                        "Pozorrubio", "Rosales", "San Carlos City", "San Fabian", "San Jacinto",
                        "San Manuel", "San Nicolas", "San Quintin", "Santa Barbara", "Santa Maria",
                        "Santo Tomas", "Sison", "Sual", "Tayug", "Umingan",
                        "Urbiztondo", "Urdaneta City", "Villasis"
                    ]
                }
            ]
        },
        {
            name: "Region II - Cagayan Valley",
            provinces: [
                {
                    name: "Batanes",
                    cities: [
                        "Basco", "Itbayat", "Ivana", "Mahatao", "Sabtang",
                        "Uyugan"
                    ]
                },
                {
                    name: "Cagayan",
                    cities: [
                        "Abulug", "Alcala", "Allacapan", "Amulung", "Aparri",
                        "Baggao", "Ballesteros", "Buguey", "Calayan", "Camalaniugan",
                        "Claveria", "Enrile", "Gattaran", "Gonzaga", "Iguig",
                        "Lal-Lo", "Lasam", "Pamplona", "Peñablanca", "Piat",
                        "Rizal", "Sanchez-Mira", "Santa Ana", "Santa Praxedes", "Santa Teresita",
                        "Santo Niño (Faire)", "Solana", "Tuao", "Tuguegarao City"
                    ]
                },
                {
                    name: "Isabela",
                    cities: [
                        "Alicia", "Angadanan", "Aurora", "Benito Soliven", "Burgos",
                        "Cabagan", "Cabatuan", "Cauayan City", "Cordon", "Delfin Albano (Magsaysay)",
                        "Dinapigue", "Divilacan", "Echague", "Gamu", "Ilagan City",
                        "Jones", "Luna", "Maconacon", "Mallig", "Naguilian",
                        "Palanan", "Quezon", "Quirino", "Ramon", "Reina Mercedes",
                        "Roxas", "San Agustin", "San Guillermo", "San Isidro", "San Manuel",
                        "San Mariano", "San Mateo", "San Pablo", "Santa Maria", "Santiago City",
                        "Santo Tomas", "Tumauini"
                    ]
                },
                {
                    name: "Nueva Vizcaya",
                    cities: [
                        "Alfonso Castaneda", "Ambaguio", "Aritao", "Bagabag", "Bambang",
                        "Bayombong", "Diadi", "Dupax del Norte", "Dupax del Sur", "Kasibu",
                        "Kayapa", "Quezon", "Santa Fe", "Solano", "Villaverde"
                    ]
                },
                {
                    name: "Quirino",
                    cities: [
                        "Aglipay", "Cabarroguis", "Diffun", "Maddela", "Nagtipunan",
                        "Saguday"
                    ]
                }
            ]
        },
        {
            name: "Region III - Central Luzon",
            provinces: [
                {
                    name: "Aurora",
                    cities: [
                        "Baler", "Casiguran", "Dilasag", "Dinalungan", "Dingalan",
                        "Dipaculao", "Maria Aurora", "San Luis"
                    ]
                },
                {
                    name: "Bataan",
                    cities: [
                        "Abucay", "Bagac", "Balanga City", "Dinalupihan", "Hermosa",
                        "Limay", "Mariveles", "Morong", "Orani", "Orion",
                        "Pilar", "Samal"
                    ]
                },
                {
                    name: "Bulacan",
                    cities: [
                        "Angat", "Balagtas (Bigaa)", "Baliuag", "Bocaue", "Bulacan",
                        "Bustos", "Calumpit", "Doña Remedios Trinidad", "Guiguinto", "Hagonoy",
                        "Malolos City", "Marilao", "Meycauayan City", "Norzagaray", "Obando",
                        "Pandi", "Paombong", "Plaridel", "Pulilan", "San Ildefonso",
                        "San Jose del Monte City", "San Miguel", "San Rafael", "Santa Maria"
                    ]
                },
                {
                    name: "Nueva Ecija",
                    cities: [
                        "Aliaga", "Bongabon", "Cabanatuan City", "Cabiao", "Carranglan",
                        "Cuyapo", "Gabaldon (Bitulok and Sabani)", "Gapan City", "General Mamerto Natividad", "General Tinio (Papaya)",
                        "Guimba", "Jaen", "Laur", "Licab", "Llanera",
                        "Lupao", "Nampicuan", "Palayan City", "Pantabangan", "Peñaranda",
                        "Quezon", "Rizal", "San Antonio", "San Isidro", "San Jose City",
                        "San Leonardo", "Santa Rosa", "Santo Domingo", "Science City of Muñoz", "Talavera",
                        "Talugtug", "Zaragoza"
                    ]
                },
                {
                    name: "Pampanga",
                    cities: [
                        "Angeles City", "Apalit", "Arayat", "Bacolor", "Candaba",
                        "Floridablanca", "Guagua", "Lubao", "Mabalacat City", "Macabebe",
                        "Magalang", "Masantol", "Mexico", "Minalin", "Porac",
                        "San Fernando City", "San Luis", "San Simon", "Santa Ana", "Santa Rita",
                        "Santo Tomas", "Sasmuan (Sexmoan)"
                    ]
                },
                {
                    name: "Tarlac",
                    cities: [
                        "Anao", "Bamban", "Camiling", "Capas", "Concepcion",
                        "Gerona", "La Paz", "Mayantoc", "Moncada", "Paniqui",
                        "Pura", "Ramos", "San Clemente", "San Jose", "San Manuel",
                        "Santa Ignacia", "Tarlac City", "Victoria"
                    ]
                },
                {
                    name: "Zambales",
                    cities: [
                        "Botolan", "Cabangan", "Candelaria", "Castillejos", "Iba",
                        "Masinloc", "Olongapo City", "Palauig", "San Antonio", "San Felipe",
                        "San Marcelino", "San Narciso", "Santa Cruz", "Subic"
                    ]
                }
            ]
        },
        {
            name: "Region IV-A - CALABARZON",
            provinces: [
                {
                    name: "Batangas",
                    cities: [
                        "Agoncillo", "Alitagtag", "Balayan", "Balete", "Batangas City",
                        "Bauan", "Calaca", "Calatagan", "Cuenca", "Ibaan",
                        "Laurel", "Lemery", "Lian", "Lipa City", "Lobo",
                        "Mabini", "Malvar", "Mataas Na Kahoy", "Nasugbu", "Padre Garcia",
                        "Rosario", "San Jose", "San Juan", "San Luis", "San Nicolas",
                        "San Pascual", "Santa Teresita", "Santo Tomas", "Taal", "Talisay",
                        "Tanauan City", "Taysan", "Tingloy", "Tuy"
                    ]
                },
                {
                    name: "Cavite",
                    cities: [
                        "Alfonso", "Amadeo", "Bacoor City", "Carmona", "Cavite City",
                        "Dasmariñas City", "Gen. Mariano Alvarez", "General Emilio Aguinaldo", "General Trias City", "Imus City",
                        "Indang", "Kawit", "Magallanes", "Maragondon", "Mendez (Mendez-Nuñez)",
                        "Naic", "Noveleta", "Rosario", "Silang", "Tagaytay City",
                        "Tanza", "Ternate", "Trece Martires City"
                    ]
                },
                {
                    name: "Laguna",
                    cities: [
                        "Alaminos", "Bay", "Biñan City", "Cabuyao City", "Calamba City",
                        "Calauan", "Cavinti", "Famy", "Kalayaan", "Liliw",
                        "Los Baños", "Luisiana", "Lumban", "Mabitac", "Magdalena",
                        "Majayjay", "Nagcarlan", "Paete", "Pagsanjan", "Pakil",
                        "Pangil", "Pila", "Rizal", "San Pablo City", "San Pedro City",
                        "Santa Cruz", "Santa Maria", "Santa Rosa City", "Siniloan", "Victoria"
                    ]
                },
                {
                    name: "Quezon",
                    cities: [
                        "Agdangan", "Alabat", "Atimonan", "Buenavista", "Burdeos",
                        "Calauag", "Candelaria", "Catanauan", "Dolores", "General Luna",
                        "General Nakar", "Guinayangan", "Gumaca", "Infanta", "Jomalig",
                        "Lopez", "Lucban", "Lucena City", "Macalelon", "Mauban",
                        "Mulanay", "Padre Burgos", "Pagbilao", "Panukulan", "Patnanungan",
                        "Perez", "Pitogo", "Plaridel", "Polillo", "Quezon",
                        "Real", "Sampaloc", "San Andres", "San Antonio", "San Francisco (Aurora)",
                        "San Narciso", "Sariaya", "Tagkawayan", "Tayabas City", "Tiaong",
                        "Unisan"
                    ]
                },
                {
                    name: "Rizal",
                    cities: [
                        "Angono", "Antipolo City", "Baras", "Binangonan", "Cainta",
                        "Cardona", "Jala-Jala", "Morong", "Pililla", "Rodriguez (Montalban)",
                        "San Mateo", "Tanay", "Taytay", "Teresa"
                    ]
                }
            ]
        },
        {
            name: "Region IV-B - MIMAROPA",
            provinces: [
                {
                    name: "Marinduque",
                    cities: [
                        "Boac", "Buenavista", "Gasan", "Mogpog", "Santa Cruz",
                        "Torrijos"
                    ]
                },
                {
                    name: "Occidental Mindoro",
                    cities: [
                        "Abra de Ilog", "Calintaan", "Looc", "Lubang", "Magsaysay",
                        "Mamburao", "Paluan", "Rizal", "Sablayan", "San Jose",
                        "Santa Cruz"
                    ]
                },
                {
                    name: "Oriental Mindoro",
                    cities: [
                        "Baco", "Bansud", "Bongabong", "Bulalacao (San Pedro)", "Calapan City",
                        "Gloria", "Mansalay", "Naujan", "Pinamalayan", "Pola",
                        "Puerto Galera", "Roxas", "San Teodoro", "Socorro", "Victoria"
                    ]
                },
                {
                    name: "Palawan",
                    cities: [
                        "Aborlan", "Agutaya", "Araceli", "Balabac", "Bataraza",
                        "Brooke's Point", "Busuanga", "Cagayancillo", "Coron", "Culion",
                        "Cuyo", "Dumaran", "El Nido (Bacuit)", "Kalayaan", "Linapacan",
                        "Magsaysay", "Narra", "Puerto Princesa City", "Quezon", "Rizal (Marcos)",
                        "Roxas", "San Vicente", "Sofronio Española", "Taytay"
                    ]
                },
                {
                    name: "Romblon",
                    cities: [
                        "Alcantara", "Banton", "Cajidiocan", "Calatrava", "Concepcion",
                        "Corcuera", "Ferrol", "Looc", "Magdiwang", "Odiongan",
                        "Romblon", "San Agustin", "San Andres", "San Fernando", "San Jose",
                        "Santa Fe", "Santa Maria (Imelda)"
                    ]
                }
            ]
        },
        {
            name: "Region V - Bicol Region",
            provinces: [
                {
                    name: "Albay",
                    cities: [
                        "Bacacay", "Camalig", "Daraga (Locsin)", "Guinobatan", "Jovellar",
                        "Legazpi City", "Libon", "Ligao City", "Malilipot", "Malinao",
                        "Manito", "Oas", "Pio Duran", "Polangui", "Rapu-Rapu",
                        "Santo Domingo (Libog)", "Tabaco City", "Tiwi"
                    ]
                },
                {
                    name: "Camarines Norte",
                    cities: [
                        "Basud", "Capalonga", "Daet", "Jose Panganiban", "Labo",
                        "Mercedes", "Paracale", "San Lorenzo Ruiz (Imelda)", "San Vicente", "Santa Elena",
                        "Talisay", "Vinzons"
                    ]
                },
                {
                    name: "Camarines Sur",
                    cities: [
                        "Baao", "Balatan", "Bato", "Bombon", "Buhi",
                        "Bula", "Cabusao", "Calabanga", "Camaligan", "Canaman",
                        "Caramoan", "Del Gallego", "Gainza", "Garchitorena", "Goa",
                        "Iriga City", "Lagonoy", "Libmanan", "Lupi", "Magarao",
                        "Milaor", "Minalabac", "Nabua", "Naga City", "Ocampo",
                        "Pamplona", "Pasacao", "Pili", "Presentacion (Parubcan)", "Ragay",
                        "Sagñay", "San Fernando", "San Jose", "Sipocot", "Siruma",
                        "Tigaon", "Tinambac"
                    ]
                },
                {
                    name: "Catanduanes",
                    cities: [
                        "Bagamanoc", "Baras", "Bato", "Caramoran", "Gigmoto",
                        "Pandan", "Panganiban (Payo)", "San Andres (Calolbon)", "San Miguel", "Viga",
                        "Virac"
                    ]
                },
                {
                    name: "Masbate",
                    cities: [
                        "Aroroy", "Baleno", "Balud", "Batuan", "Cataingan",
                        "Cawayan", "Claveria", "Dimasalang", "Esperanza", "Mandaon",
                        "Masbate City", "Milagros", "Mobo", "Monreal", "Palanas",
                        "Pio V. Corpuz (Limbuhan)", "Placer", "San Fernando", "San Jacinto", "San Pascual",
                        "Uson"
                    ]
                },
                {
                    name: "Sorsogon",
                    cities: [
                        "Barcelona", "Bulan", "Bulusan", "Casiguran", "Castilla",
                        "Donsol", "Gubat", "Irosin", "Juban", "Magallanes",
                        "Matnog", "Pilar", "Prieto Diaz", "Santa Magdalena", "Sorsogon City"
                    ]
                }
            ]
        },
        {
            name: "Region VI - Western Visayas",
            provinces: [
                {
                    name: "Aklan",
                    cities: [
                        "Altavas", "Balete", "Banga", "Batan", "Buruanga",
                        "Ibajay", "Kalibo", "Lezo", "Libacao", "Madalag",
                        "Makato", "Malay", "Malinao", "Nabas", "New Washington",
                        "Numancia", "Tangalan"
                    ]
                },
                {
                    name: "Antique",
                    cities: [
                        "Anini-y", "Barbaza", "Belison", "Bugasong", "Caluya",
                        "Culasi", "Hamtic", "Laua-An", "Libertad", "Pandan",
                        "Patnongon", "San Jose", "San Remigio", "Sebaste", "Sibalom",
                        "Tibiao", "Tobias Fornier (Dao)", "Valderrama"
                    ]
                },
                {
                    name: "Capiz",
                    cities: [
                        "Cuartero", "Dao", "Dumalag", "Dumarao", "Ivisan",
                        "Jamindan", "Ma-Ayon", "Mambusao", "Panay", "Panitan",
                        "Pilar", "Pontevedra", "President Roxas", "Roxas City", "Sapi-An",
                        "Sigma", "Tapaz"
                    ]
                },
                {
                    name: "Guimaras",
                    cities: [
                        "Buenavista", "Jordan", "Nueva Valencia", "San Lorenzo", "Sibunag"
                    ]
                },
                {
                    name: "Iloilo",
                    cities: [
                        "Ajuy", "Alimodian", "Anilao", "Badiangan", "Balasan",
                        "Banate", "Barotac Nuevo", "Barotac Viejo", "Batad", "Bingawan",
                        "Cabatuan", "Calinog", "Carles", "Concepcion", "Dingle",
                        "Dueñas", "Dumangas", "Estancia", "Guimbal", "Igbaras",
                        "Iloilo City", "Janiuay", "Lambunao", "Leganes", "Lemery",
                        "Leon", "Maasin", "Miagao", "Mina", "New Lucena",
                        "Oton", "Passi City", "Pavia", "Pototan", "San Dionisio",
                        "San Enrique", "San Joaquin", "San Miguel", "San Rafael", "Santa Barbara",
                        "Sara", "Tigbauan", "Tubungan", "Zarraga"
                    ]
                },
                {
                    name: "Negros Occidental",
                    cities: [
                        "Bacolod City", "Bago City", "Binalbagan", "Cadiz City", "Calatrava",
                        "Candoni", "Cauayan", "Enrique B. Magalona (Saravia)", "Escalante City", "Himamaylan City",
                        "Hinigaran", "Hinoba-An (Asia)", "Ilog", "Isabela", "Kabankalan City",
                        "La Carlota City", "La Castellana", "Manapla", "Moises Padilla (Magallon)", "Murcia",
                        "Pontevedra", "Pulupandan", "Sagay City", "Salvador Benedicto", "San Carlos City",
                        "San Enrique", "Silay City", "Sipalay City", "Talisay City", "Toboso",
                        "Valladolid", "Victorias City"
                    ]
                }
            ]
        },
        {
            name: "Region VII - Central Visayas",
            provinces: [
                {
                    name: "Bohol",
                    cities: [
                        "Alburquerque", "Alicia", "Anda", "Antequera", "Baclayon",
                        "Balilihan", "Batuan", "Bien Unido", "Bilar", "Buenavista",
                        "Calape", "Candijay", "Carmen", "Catigbian", "Clarin",
                        "Corella", "Cortes", "Dagohoy", "Danao", "Dauis",
                        "Dimiao", "Duero", "Garcia Hernandez", "Guindulman", "Inabanga",
                        "Jagna", "Jetafe", "Lila", "Loay", "Loboc",
                        "Loon", "Mabini", "Maribojoc", "Panglao", "Pilar",
                        "Pres. Carlos P. Garcia (Pitogo)", "Sagbayan (Borja)", "San Isidro", "San Miguel", "Sevilla",
                        "Sierra Bullones", "Sikatuna", "Tagbilaran City", "Talibon", "Trinidad",
                        "Tubigon", "Ubay", "Valencia"
                    ]
                },
                {
                    name: "Cebu",
                    cities: [
                        "Alcantara", "Alcoy", "Alegria", "Aloguinsan", "Argao",
                        "Asturias", "Badian", "Balamban", "Bantayan", "Barili",
                        "Bogo City", "Boljoon", "Borbon", "Carcar City", "Carmen",
                        "Catmon", "Cebu City", "Compostela", "Consolacion", "Cordoba",
                        "Daanbantayan", "Dalaguete", "Danao City", "Dumanjug", "Ginatilan",
                        "Lapu-Lapu City (Opon)", "Liloan", "Madridejos", "Malabuyoc", "Mandaue City",
                        "Medellin", "Minglanilla", "Moalboal", "Naga City", "Oslob",
                        "Pilar", "Pinamungahan", "Poro", "Ronda", "Samboan",
                        "San Fernando", "San Francisco", "San Remigio", "Santa Fe", "Santander",
                        "Sibonga", "Sogod", "Tabogon", "Tabuelan", "Talisay City",
                        "Toledo City", "Tuburan", "Tudela"
                    ]
                },
                {
                    name: "Negros Oriental",
                    cities: [
                        "Amlan (Ayuquitan)", "Ayungon", "Bacong", "Bais City", "Basay",
                        "Bayawan City (Tulong)", "Bindoy (Payabon)", "Canlaon City", "Dauin", "Dumaguete City",
                        "Guihulngan City", "Jimalalud", "La Libertad", "Mabinay", "Manjuyod",
                        "Pamplona", "San Jose", "Santa Catalina", "Siaton", "Sibulan",
                        "Tanjay City", "Tayasan", "Valencia (Luzurriaga)", "Vallehermoso", "Zamboanguita"
                    ]
                },
                {
                    name: "Siquijor",
                    cities: [
                        "Enrique Villanueva", "Larena", "Lazi", "Maria", "San Juan",
                        "Siquijor"
                    ]
                }
            ]
        },
        {
            name: "Region VIII - Eastern Visayas",
            provinces: [
                {
                    name: "Biliran",
                    cities: [
                        "Almeria", "Biliran", "Cabucgayan", "Caibiran", "Culaba",
                        "Kawayan", "Maripipi", "Naval"
                    ]
                },
                {
                    name: "Eastern Samar",
                    cities: [
                        "Arteche", "Balangiga", "Balangkayan", "Borongan City", "Can-Avid",
                        "Dolores", "General Macarthur", "Giporlos", "Guiuan", "Hernani",
                        "Jipapad", "Lawaan", "Llorente", "Maslog", "Maydolong",
                        "Mercedes", "Oras", "Quinapondan", "Salcedo", "San Julian",
                        "San Policarpo", "Sulat", "Taft"
                    ]
                },
                {
                    name: "Leyte",
                    cities: [
                        "Abuyog", "Alangalang", "Albuera", "Babatngon", "Barugo",
                        "Bato", "Baybay City", "Burauen", "Calubian", "Capoocan",
                        "Carigara", "Dagami", "Dulag", "Hilongos", "Hindang",
                        "Inopacan", "Isabel", "Jaro", "Javier (Bugho)", "Julita",
                        "Kananga", "La Paz", "Leyte", "Macarthur", "Mahaplag",
                        "Matag-Ob", "Matalom", "Mayorga", "Merida", "Ormoc City",
                        "Palo", "Palompon", "Pastrana", "San Isidro", "San Miguel",
                        "Santa Fe", "Tabango", "Tabontabon", "Tacloban City", "Tanauan",
                        "Tolosa", "Tunga", "Villaba"
                    ]
                },
                {
                    name: "Northern Samar",
                    cities: [
                        "Allen", "Biri", "Bobon", "Capul", "Catarman",
                        "Catubig", "Gamay", "Laoang", "Lapinig", "Las Navas",
                        "Lavezares", "Lope de Vega", "Mapanas", "Mondragon", "Palapag",
                        "Pambujan", "Rosario", "San Antonio", "San Isidro", "San Jose",
                        "San Roque", "San Vicente", "Silvino Lobos", "Victoria"
                    ]
                },
                {
                    name: "Samar (Western Samar)",
                    cities: [
                        "Almagro", "Basey", "Calbayog City", "Calbiga", "Catbalogan City",
                        "Daram", "Gandara", "Hinabangan", "Jiabong", "Marabut",
                        "Matuguinao", "Motiong", "Pagsanghan", "Paranas (Wright)", "Pinabacdao",
                        "San Jorge", "San Jose de Buan", "San Sebastian", "Santa Margarita", "Santa Rita",
                        "Santo Niño", "Tagapul-An", "Talalora", "Tarangnan", "Villareal",
                        "Zumarraga"
                    ]
                },
                {
                    name: "Southern Leyte",
                    cities: [
                        "Anahawan", "Bontoc", "Hinunangan", "Hinundayan", "Libagon",
                        "Liloan", "Limasawa", "Maasin City", "Macrohon", "Malitbog",
                        "Padre Burgos", "Pintuyan", "Saint Bernard", "San Francisco", "San Juan (Cabalian)",
                        "San Ricardo", "Silago", "Sogod", "Tomas Oppus"
                    ]
                }
            ]
        },
        {
            name: "Region IX - Zamboanga Peninsula",
            provinces: [
                {
                    name: "Zamboanga del Norte",
                    cities: [
                        "Bacungan (Leon T. Postigo)", "Baliguian", "Dapitan City", "Dipolog City", "Godod",
                        "Gutalac", "Jose Dalman (Ponot)", "Kalawit", "Katipunan", "La Libertad",
                        "Labason", "Liloy", "Manukan", "Mutia", "Piñan (New Piñan)",
                        "Polanco", "Pres. Manuel A. Roxas", "Rizal", "Salug", "Sergio Osmeña Sr.",
                        "Siayan", "Sibuco", "Sibutad", "Sindangan", "Siocon",
                        "Sirawai", "Tampilisan"
                    ]
                },
                {
                    name: "Zamboanga del Sur",
                    cities: [
                        "Aurora", "Bayog", "Dimataling", "Dinas", "Dumalinao",
                        "Dumingag", "Guipos", "Josefina", "Kumalarang", "Labangan",
                        "Lakewood", "Lapuyan", "Mahayag", "Margosatubig", "Midsalip",
                        "Molave", "Pagadian City", "Pitogo", "Ramon Magsaysay (Liargo)", "San Miguel",
                        "San Pablo", "Sominot (Don Mariano Marcos)", "Tabina", "Tambulig", "Tigbao",
                        "Tukuran", "Vincenzo A. Sagun", "Zamboanga City"
                    ]
                },
                {
                    name: "Zamboanga Sibugay",
                    cities: [
                        "Alicia", "Buug", "Diplahan", "Imelda", "Ipil",
                        "Kabasalan", "Mabuhay", "Malangas", "Naga", "Olutanga",
                        "Payao", "Roseller Lim", "Siay", "Talusan", "Titay",
                        "Tungawan"
                    ]
                }
            ]
        },
        {
            name: "Region X - Northern Mindanao",
            provinces: [
                {
                    name: "Bukidnon",
                    cities: [
                        "Baungon", "Cabanglasan", "Damulog", "Dangcagan", "Don Carlos",
                        "Impasug-Ong", "Kadingilan", "Kalilangan", "Kibawe", "Kitaotao",
                        "Lantapan", "Libona", "Malaybalay City", "Malitbog", "Manolo Fortich",
                        "Maramag", "Pangantucan", "Quezon", "San Fernando", "Sumilao",
                        "Talakag", "Valencia City"
                    ]
                },
                {
                    name: "Camiguin",
                    cities: [
                        "Catarman", "Guinsiliban", "Mahinog", "Mambajao", "Sagay"
                    ]
                },
                {
                    name: "Lanao del Norte",
                    cities: [
                        "Bacolod", "Baloi", "Baroy", "Iligan City", "Kapatagan",
                        "Kauswagan", "Kolambugan", "Lala", "Linamon", "Magsaysay",
                        "Maigo", "Matungao", "Munai", "Nunungan", "Pantao Ragat",
                        "Pantar", "Poona Piagapo", "Salvador", "Sapad", "Sultan Naga Dimaporo (Karomatan)",
                        "Tagoloan", "Tangcal", "Tubod"
                    ]
                },
                {
                    name: "Misamis Occidental",
                    cities: [
                        "Aloran", "Baliangao", "Bonifacio", "Calamba", "Clarin",
                        "Concepcion", "Don Victoriano Chiongbian (Don Mariano Marcos)", "Jimenez", "Lopez Jaena", "Oroquieta City",
                        "Ozamis City", "Panaon", "Plaridel", "Sapang Dalaga", "Sinacaban",
                        "Tangub City", "Tudela"
                    ]
                },
                {
                    name: "Misamis Oriental",
                    cities: [
                        "Alubijid", "Balingasag", "Balingoan", "Binuangan", "Cagayan de Oro City",
                        "Claveria", "El Salvador City", "Gingoog City", "Gitagum", "Initao",
                        "Jasaan", "Kinoguitan", "Lagonglong", "Laguindingan", "Libertad",
                        "Lugait", "Magsaysay (Linugos)", "Manticao", "Medina", "Naawan",
                        "Opol", "Salay", "Sugbongcogon", "Tagoloan", "Talisayan",
                        "Villanueva"
                    ]
                }
            ]
        },
        {
            name: "Region XI - Davao Region",
            provinces: [
                {
                    name: "Compostela Valley",
                    cities: [
                        "Compostela", "Laak (San Vicente)", "Mabini (Doña Alicia)", "Maco", "Maragusan (San Mariano)",
                        "Mawab", "Monkayo", "Montevista", "Nabunturan", "New Bataan",
                        "Pantukan"
                    ]
                },
                {
                    name: "Davao (Davao del Norte)",
                    cities: [
                        "Asuncion (Saug)", "Braulio E. Dujali", "Carmen", "Island Garden City of Samal", "Kapalong",
                        "New Corella", "Panabo City", "San Isidro", "Santo Tomas", "Tagum City",
                        "Talaingod"
                    ]
                },
                {
                    name: "Davao del Sur",
                    cities: [
                        "Bansalan", "Davao City", "Digos City", "Hagonoy", "Kiblawan",
                        "Magsaysay", "Malalag", "Matanao", "Padada", "Santa Cruz",
                        "Sulop"
                    ]
                },
                {
                    name: "Davao Occidental",
                    cities: [
                        "Don Marcelino", "Jose Abad Santos (Trinidad)", "Malita", "Santa Maria", "Sarangani"
                    ]
                },
                {
                    name: "Davao Oriental",
                    cities: [
                        "Baganga", "Banaybanay", "Boston", "Caraga", "Cateel",
                        "Governor Generoso", "Lupon", "Manay", "Mati City", "San Isidro",
                        "Tarragona"
                    ]
                }
            ]
        },
        {
            name: "Region XII - SOCCSKSARGEN",
            provinces: [
                {
                    name: "Cotabato (North Cot.)",
                    cities: [
                        "Alamada", "Aleosan", "Antipas", "Arakan", "Banisilan",
                        "Carmen", "Kabacan", "Kidapawan City", "Libungan", "M'lang",
                        "Magpet", "Makilala", "Matalam", "Midsayap", "Pigkawayan",
                        "Pikit", "President Roxas", "Tulunan"
                    ]
                },
                {
                    name: "Sarangani",
                    cities: [
                        "Alabel", "Glan", "Kiamba", "Maasim", "Maitum",
                        "Malapatan", "Malungon"
                    ]
                },
                {
                    name: "South Cotabato",
                    cities: [
                        "Banga", "General Santos City (Dadiangas)", "Koronadal City", "Lake Sebu", "Norala",
                        "Polomolok", "Santo Niño", "Surallah", "T`boli", "Tampakan",
                        "Tantangan", "Tupi"
                    ]
                },
                {
                    name: "Sultan Kudarat",
                    cities: [
                        "Bagumbayan", "Columbio", "Esperanza", "Isulan", "Kalamansig",
                        "Lambayong (Mariano Marcos)", "Lebak", "Lutayan", "Palimbang", "President Quirino",
                        "Sen. Ninoy Aquino", "Tacurong City"
                    ]
                }
            ]
        },
        {
            name: "Region XIII - Caraga",
            provinces: [
                {
                    name: "Agusan del Norte",
                    cities: [
                        "Buenavista", "Butuan City", "Cabadbaran City", "Carmen", "Jabonga",
                        "Kitcharao", "Las Nieves", "Magallanes", "Nasipit", "Remedios T. Romualdez",
                        "Santiago", "Tubay"
                    ]
                },
                {
                    name: "Agusan del Sur",
                    cities: [
                        "Bayugan City", "Bunawan", "Esperanza", "La Paz", "Loreto",
                        "Prosperidad", "Rosario", "San Francisco", "San Luis", "Santa Josefa",
                        "Sibagat", "Talacogon", "Trento", "Veruela"
                    ]
                },
                {
                    name: "Dinagat Islands",
                    cities: [
                        "Basilisa (Rizal)", "Cagdianao", "Dinagat", "Libjo (Albor)", "Loreto",
                        "San Jose", "Tubajon"
                    ]
                },
                {
                    name: "Surigao del Norte",
                    cities: [
                        "Alegria", "Bacuag", "Burgos", "Claver", "Dapa",
                        "Del Carmen", "General Luna", "Gigaquit", "Mainit", "Malimono",
                        "Pilar", "Placer", "San Benito", "San Francisco (Anao-Aon)", "San Isidro",
                        "Santa Monica (Sapao)", "Sison", "Socorro", "Surigao City", "Tagana-An",
                        "Tubod"
                    ]
                },
                {
                    name: "Surigao del Sur",
                    cities: [
                        "Barobo", "Bayabas", "Bislig City", "Cagwait", "Cantilan",
                        "Carmen", "Carrascal", "Cortes", "Hinatuan", "Lanuza",
                        "Lianga", "Lingig", "Madrid", "Marihatag", "San Agustin",
                        "San Miguel", "Tagbina", "Tago", "Tandag City"
                    ]
                }
            ]
        },
        {
            name: "BARMM - Bangsamoro",
            provinces: [
                {
                    name: "Basilan",
                    cities: [
                        "Akbar", "Al-Barka", "Hadji Mohammad Ajul", "Hadji Muhtamad", "Isabela City",
                        "Lamitan City", "Lantawan", "Maluso", "Sumisip", "Tabuan-Lasa",
                        "Tipo-Tipo", "Tuburan", "Ungkaya Pukan"
                    ]
                },
                {
                    name: "Lanao del Sur",
                    cities: [
                        "Amai Manabilang (Bumbaran)", "Bacolod-Kalawi (Bacolod Grande)", "Balabagan", "Balindong (Watu)", "Bayang",
                        "Binidayan", "Buadiposo-Buntong", "Bubong", "Butig", "Calanogas",
                        "Ditsaan-Ramain", "Ganassi", "Kapai", "Kapatagan", "Lumba-Bayabao (Maguing)",
                        "Lumbaca-Unayan", "Lumbatan", "Lumbayanague", "Madalum", "Madamba",
                        "Maguing", "Malabang", "Marantao", "Marawi City", "Marogong",
                        "Masiu", "Mulondo", "Pagayawan (Tatarikan)", "Piagapo", "Picong (Sultan Gumander)",
                        "Poona Bayabao (Gata)", "Pualas", "Saguiaran", "Sultan Dumalondong", "Tagoloan",
                        "Tamparan", "Taraka", "Tubaran", "Tugaya", "Wao"
                    ]
                },
                {
                    name: "Maguindanao",
                    cities: [
                        "Ampatuan", "Barira", "Buldon", "Buluan", "Cotabato City",
                        "Datu Abdullah Sangki", "Datu Anggal Midtimbang", "Datu Blah T. Sinsuat", "Datu Hoffer Ampatuan", "Datu Odin Sinsuat (Dinaig)",
                        "Datu Paglas", "Datu Piang", "Datu Salibo", "Datu Saudi Ampatuan", "Datu Unsay",
                        "Gen. S. K. Pendatun", "Guindulungan", "Kabuntalan (Tumbao)", "Mamasapano", "Mangudadatu",
                        "Matanog", "Northern Kabuntalan", "Pagagawan", "Pagalungan", "Paglat",
                        "Pandag", "Parang", "Rajah Buayan", "Shariff Aguak (Maganoy)", "Shariff Saydona Mustapha",
                        "South Upi", "Sultan Kudarat (Nuling)", "Sultan Mastura", "Sultan sa Barongis (Lambayong)", "Talayan",
                        "Talitay", "Upi"
                    ]
                },
                {
                    name: "Sulu",
                    cities: [
                        "Hadji Panglima Tahil (Marunggas)", "Indanan", "Jolo", "Kalingalan Caluang", "Lugus",
                        "Luuk", "Maimbung", "Old Panamao", "Omar", "Pandami",
                        "Panglima Estino (New Panamao)", "Pangutaran", "Parang", "Pata", "Patikul",
                        "Siasi", "Talipao", "Tapul", "Tongkil"
                    ]
                },
                {
                    name: "Tawi-Tawi",
                    cities: [
                        "Bongao", "Languyan", "Mapun (Cagayan de Tawi-Tawi)", "Panglima Sugala (Balimbing)", "Sapa-Sapa",
                        "Sibutu", "Simunul", "Sitangkai", "South Ubian", "Tandubas",
                        "Turtle Islands"
                    ]
                }
            ]
        },
        {
            name: "CAR - Cordillera Administrative Region",
            provinces: [
                {
                    name: "Abra",
                    cities: [
                        "Bangued", "Boliney", "Bucay", "Bucloc", "Daguioman",
                        "Danglas", "Dolores", "La Paz", "Lacub", "Lagangilang",
                        "Lagayan", "Langiden", "Licuan-Baay (Licuan)", "Luba", "Malibcong",
                        "Manabo", "Peñarrubia", "Pidigan", "Pilar", "Sallapadan",
                        "San Isidro", "San Juan", "San Quintin", "Tayum", "Tineg",
                        "Tubo", "Villaviciosa"
                    ]
                },
                {
                    name: "Apayao",
                    cities: [
                        "Calanasan (Bayag)", "Conner", "Flora", "Kabugao", "Luna",
                        "Pudtol", "Santa Marcela"
                    ]
                },
                {
                    name: "Benguet",
                    cities: [
                        "Atok", "Baguio City", "Bakun", "Bokod", "Buguias",
                        "Itogon", "Kabayan", "Kapangan", "Kibungan", "La Trinidad",
                        "Mankayan", "Sablan", "Tuba", "Tublay"
                    ]
                },
                {
                    name: "Ifugao",
                    cities: [
                        "Aguinaldo", "Alfonso Lista (Potia)", "Asipulo", "Banaue", "Hingyon",
                        "Hungduan", "Kiangan", "Lagawe", "Lamut", "Mayoyao",
                        "Tinoc"
                    ]
                },
                {
                    name: "Kalinga",
                    cities: [
                        "Balbalan", "Lubuagan", "Pasil", "Pinukpuk", "Rizal (Liwan)",
                        "Tabuk City", "Tanudan", "Tinglayan"
                    ]
                },
                {
                    name: "Mountain Province",
                    cities: [
                        "Barlig", "Bauko", "Besao", "Bontoc", "Natonin",
                        "Paracelis", "Sabangan", "Sadanga", "Sagada", "Tadian"
                    ]
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

// Coffee style options (2nd-wave vs 3rd-wave classification)
export const COFFEE_STYLES = [
    { value: "classic", label: "Classic", description: "Traditional espresso bar style (2nd-wave)" },
    { value: "artisan", label: "Artisan", description: "Craft/specialty focus (3rd-wave)" },
] as const;

export type CoffeeStyle = typeof COFFEE_STYLES[number]["value"];

// Common brew methods
export const BREW_METHODS = [
    "Espresso", "Pour Over", "French Press", "Aeropress", "Cold Brew",
    "Chemex", "V60", "Siphon", "Moka Pot", "Drip Coffee"
];

// Straw type options
export const STRAW_TYPES = ["plastic", "paper", "metal", "stalk", "other"] as const

// Payment method options
export const PAYMENT_METHODS = [
    "cash",
    "credit_card",
    "debit_card",
    "gcash",
    "maya",
    "qrph",
    "bank_transfer",
]
