(function () {
    // --- গ্লোবাল কনস্ট্যান্টস ---
    const STORAGE_KEY = 'emergencyHotlineState';
    
    // --- Geolocation Functions (Nearest Service) ---

    /**
     * দুটি স্থানাঙ্কের মধ্যে দূরত্ব পরিমাপ (Haversine Formula)
     * @param {number} lat1 - প্রথম বিন্দুর অক্ষাংশ
     * @param {number} lon1 - প্রথম বিন্দুর দ্রাঘিমাংশ
     * @param {number} lat2 - দ্বিতীয় বিন্দুর অক্ষাংশ
     * @param {number} lon2 - দ্বিতীয় বিন্দুর দ্রাঘিমাংশ
     * @returns {number} দূরত্ব কিলোমিটারে
     */
    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // পৃথিবীর ব্যাসার্ধ কিলোমিটার-এ
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // দূরত্ব কিলোমিটারে
    }

    /**
     * ব্যবহারকারীর বর্তমান অবস্থান জানার ফাংশন (Promise-ভিত্তিক)
     * @returns {Promise<{lat: number, lng: number} | null>} স্থানাঙ্ক বা null
     */
    function getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        console.log("Location obtained.");
                        resolve({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        });
                    },
                    (error) => {
                        console.log("Geolocation blocked or error: ", error.message);
                        resolve(null); // অনুমতি না দিলে null রিটার্ন করবে
                    },
                    { timeout: 5000 } // 5 সেকেন্ড পর টাইমআউট
                );
            } else {
                resolve(null);
            }
        });
    }

    /**
     * সার্ভিসগুলিকে ব্যবহারকারীর দূরত্ব অনুসারে সাজানোর ফাংশন
     * @param {Array<Object>} services - সার্ভিসের তালিকা
     * @returns {Promise<Array<Object>>} দূরত্ব অনুসারে সাজানো তালিকা
     */
    async function sortByNearest(services) {
        const userLocation = await getCurrentLocation();

        if (!userLocation) {
            // অবস্থান না পাওয়া গেলে, ডিফল্ট ক্রমেই রিটার্ন
            return services;
        }

        const servicesWithDistance = services
            .map(svc => {
                if (svc.lat && svc.lng) {
                    const distance = getDistance(
                        userLocation.lat,
                        userLocation.lng,
                        svc.lat,
                        svc.lng
                    );
                    // দূরত্বটিকে rounding করে কিলোমিটারে svc-এর সাথে যোগ করা
                    return { ...svc, distance: distance.toFixed(1) };
                }
                return { ...svc, distance: Infinity }; // স্থানাঙ্ক না থাকলে শেষে রাখবে
            })
            .sort((a, b) => a.distance - b.distance); // দূরত্ব অনুসারে ছোট থেকে বড় সাজানো

        return servicesWithDistance;
    }
    // --- End Geolocation Functions ---

    // --- Local Storage Management ---

    function loadState() {
        try {
            const storedState = localStorage.getItem(STORAGE_KEY);
            if (storedState) {
                return JSON.parse(storedState);
            }
        } catch (e) {
            console.error("Error loading state from localStorage", e);
        }
        return {
            hearts: 0,
            copies: 0,
            services: getServices(),
            history: [],
            favoriteIds: {}
        };
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                hearts: state.hearts,
                copies: state.copies,
                history: state.history,
                favoriteIds: state.favoriteIds
            }));
        } catch (e) {
            console.error("Error saving state to localStorage", e);
        }
    }

    // --- State Initialization ---

    let state = loadState();

    // --- DOM Elements ---

    const el = {
        heartCount: document.getElementById('heartCount'),
        copyCount: document.getElementById('copyCount'),
        cardGrid: document.getElementById('cardGrid'),
        historyList: document.getElementById('historyList'),
        clearHistory: document.getElementById('clearHistory'),
        cardTemplate: document.getElementById('cardTemplate'),
        searchBar: document.getElementById('searchBar'),
    };

    // --- Core Functions ---

    async function init() {
        state.services = getServices().map(svc => ({
            ...svc,
            isFavorite: !!state.favoriteIds[svc.id]
        }));
        bindGlobalUI();
        await renderCards(state.services); // ⭐ await যুক্ত করা হয়েছে
        updateCounters();
        renderHistory();
    }

    /**
     * সার্ভিসগুলিকে ক্যাটাগরি অনুসারে গ্রুপ করে
     * @param {Array<Object>} services - সার্ভিসের তালিকা
     * @returns {Array<{category: string, services: Array<Object>}>} গ্রুপ করা তালিকা
     */
    function groupServicesByCategory(services) {
        if (el.searchBar && el.searchBar.value.trim() !== '') {
            return [{ category: 'SearchResults', services: services }];
        }

        // ... (categories অবজেক্ট অপরিবর্তিত)
        const categories = {
            'All': [],
            'Rajshahi Police': [],
            'Rajshahi Fire': [],
            'Rajshahi Ambulance': [],

            'Rajshahi Hospital': [],
            'Rajshahi Clinic': [],
            'Rajshahi Health': [],
            'Rajshahi Blood': [],
            'Rajshahi Bank': [],
            'Rajshahi Education': [],
            'Govt.': [],
            'Electricity': [],
            'Help': [],
            'Fire': [],
            'NGO': [],
            'Travel': [],
            'Utility': [],
        };

        services.forEach(svc => {
            // Logic for grouping (Rajshahi Clinic into Rajshahi Hospital group)
            if (svc.category === 'Rajshahi Clinic' || svc.category === 'Rajshahi Health' || svc.category === 'Rajshahi Private') { // Private/Clinic/Health সব Hospital গ্রুপে
                categories['Rajshahi Hospital'].push(svc);
            } else if (categories[svc.category]) {
                categories[svc.category].push(svc);
            } else if (svc.category === 'Rajshahi Govt.') {
                categories['Govt.'].push(svc);
            } else if (svc.category === 'Utility') {
                categories['Utility'].push(svc);
            }
        });

        return Object.keys(categories)
            .filter(key => categories[key].length > 0)
            .map(key => ({
                category: key,
                services: categories[key]
            }));
    }

    /**
     * কার্ডগুলিকে DOM-এ রেন্ডার করে
     * @param {Array<Object>} servicesToRender - রেন্ডার করার সার্ভিসের তালিকা
     */
    async function renderCards(servicesToRender) {
        el.cardGrid.innerHTML = '';

        // ⭐ Nearest সার্ভিসগুলোকে আগে সর্ট করে নেওয়া
        const sortedServices = await sortByNearest(servicesToRender);
        const groupedServices = groupServicesByCategory(sortedServices);


        if (servicesToRender.length === 0) {
            el.cardGrid.innerHTML = '<div class="text-center py-10 text-gray-500 font-semibold text-lg">আপনার সার্চ করা তথ্যের সাথে কোনো সার্ভিস মেলেনি।</div>';
            return;
        }

        groupedServices.forEach(group => {
            const sectionHeader = document.createElement('h2');
            sectionHeader.className = 'text-2xl md:text-3xl font-bold text-gray-800 mt-8 mb-4 border-b-2 border-green-500 pb-2';

            let sectionTitle = group.category;
            // Category Title Mapping (Bangla Translation)
            if (sectionTitle === 'SearchResults') sectionTitle = `সার্চ রেজাল্ট (${group.services.length}টি)`;
            else if (sectionTitle === 'All') sectionTitle = 'জাতীয় জরুরি হটলাইন ';
            else if (sectionTitle === 'Fire') sectionTitle = 'জাতীয় ফায়ার সার্ভিস সেবা';
            else if (sectionTitle === 'Govt.') sectionTitle = 'অন্যান্য সরকারি সেবা';
            else if (sectionTitle === 'Help') sectionTitle = 'নারী ও শিশু সহায়তা ও আইনি পরামর্শ';
            else if (sectionTitle === 'Electricity') sectionTitle = 'বিদ্যুৎ সেবা';
            else if (sectionTitle === 'Utility') sectionTitle = 'পাবলিক ইউটিলিটি (গ্যাস/পানি)';
            else if (sectionTitle === 'Rajshahi Police') sectionTitle = 'রাজশাহী পুলিশ (থানা, ওসি ও র‍্যাব)';
            else if (sectionTitle === 'Rajshahi Fire') sectionTitle = 'রাজশাহী ফায়ার সার্ভিস';
            else if (sectionTitle === 'Rajshahi Ambulance') sectionTitle = 'রাজশাহী অ্যাম্বুলেন্স সার্ভিস';
            else if (sectionTitle === 'Rajshahi Hospital') sectionTitle = 'রাজশাহী স্বাস্থ্যসেবা, হাসপাতাল ও ক্লিনিক';
            else if (sectionTitle === 'Rajshahi Blood') sectionTitle = 'রাজশাহী ব্লাড ব্যাংক';
            else if (sectionTitle === 'Rajshahi Bank') sectionTitle = 'রাজশাহী ব্যাংক (প্রধান শাখা)';
            else if (sectionTitle === 'Rajshahi Education') sectionTitle = 'রাজশাহী শিক্ষা বোর্ড ও প্রতিষ্ঠান';
            else if (sectionTitle === 'Travel') sectionTitle = 'ভ্রমণ সহায়তা (রেলওয়ে)';
            else if (sectionTitle === 'NGO') sectionTitle = 'এনজিও সহায়তা ';

            // ⭐ "Nearest Service" indication
            if (group.category === 'SearchResults' && sortedServices[0] && sortedServices[0].distance !== Infinity) {
                sectionTitle += ' (নিকটতম সার্ভিস সবার আগে)';
            }


            sectionHeader.textContent = sectionTitle;
            el.cardGrid.appendChild(sectionHeader);

            const gridContainer = document.createElement('div');
            gridContainer.className = 'grid sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5';
            el.cardGrid.appendChild(gridContainer);

            group.services.forEach(svc => {
                const card = el.cardTemplate.content.cloneNode(true);
                const cardDiv = card.querySelector('.card-item');

                card.querySelector('[data-role="icon"]').src = svc.icon;
                card.querySelector('[data-role="title"]').textContent = svc.title;
                card.querySelector('[data-role="subtitle"]').textContent = svc.subtitle;
                card.querySelector('[data-role="number"]').textContent = svc.number;

                let badgeText = svc.category;
                badgeText = badgeText.replace('Rajshahi ', '');
                badgeText = badgeText.replace('Police', 'পুলিশ');
                badgeText = badgeText.replace('Fire', 'ফায়ার');
                badgeText = badgeText.replace('Ambulance', 'অ্যাম্বুলেন্স');
                badgeText = badgeText.replace('Hospital', 'হাসপাতাল');
                badgeText = badgeText.replace('Clinic', 'ক্লিনিক');
                badgeText = badgeText.replace('Blood', 'ব্লাড');
                badgeText = badgeText.replace('Bank', 'ব্যাংক');
                badgeText = badgeText.replace('Education', 'শিক্ষা');
                badgeText = badgeText.replace('Govt.', 'সরকারি');
                badgeText = badgeText.replace('Utility', 'ইউটিলিটি');
                card.querySelector('[data-role="badge"]').textContent = badgeText;

                // ⭐ দূরত্ব ডিসপ্লে: কেবল Nearest Service এর ক্ষেত্রে দেখাবে
                if (svc.distance !== Infinity) {
                    const distanceSpan = document.createElement('span');
                    distanceSpan.className = 'text-xs font-medium text-gray-500 ml-2';
                    distanceSpan.textContent = `(${svc.distance} km)`;
                    card.querySelector('[data-role="badge"]').after(distanceSpan); // ব্যাজের পরে দূরত্ব যোগ করা
                }


                const heartIcon = card.querySelector('[data-role="heartIcon"]');

                if (svc.isFavorite) {
                    heartIcon.classList.remove('text-gray-400', 'hover:text-red-500');
                    heartIcon.classList.add('text-red-500');
                }

                bindCardEvents(card, svc);
                gridContainer.appendChild(card);
            });
        });
    }

    /**
     * সার্চ টেক্সট অনুযায়ী সার্ভিস ফিল্টার করে রেন্ডার করে
     */
    async function filterAndRender() {
        const searchText = el.searchBar.value.toLowerCase().trim();

        let servicesToRender = state.services;

        if (searchText !== '') {
            servicesToRender = state.services.filter(svc => {
                return (
                    svc.title.toLowerCase().includes(searchText) ||
                    svc.subtitle.toLowerCase().includes(searchText) ||
                    svc.number.includes(searchText) ||
                    svc.category.toLowerCase().includes(searchText)
                );
            });
        }

        await renderCards(servicesToRender);
    }

    /**
     * প্রতিটি কার্ডের ইভেন্ট হ্যান্ডলার যুক্ত করে
     * @param {Node} cardElement - কার্ডের DOM উপাদান
     * @param {Object} svc - সার্ভিসের ডেটা অবজেক্ট
     */
    function bindCardEvents(cardElement, svc) {
        // --- Heart Event ---
        cardElement.querySelector('[data-role="heartBtn"]').addEventListener('click', (e) => {
            const index = state.services.findIndex(s => s.id === svc.id);
            if (index > -1) {
                state.services[index].isFavorite = !state.services[index].isFavorite;
                svc.isFavorite = state.services[index].isFavorite;

                const currentHeartIcon = e.currentTarget.querySelector('[data-role="heartIcon"]');

                if (svc.isFavorite) {
                    state.hearts += 1;
                    state.favoriteIds[svc.id] = true;
                    currentHeartIcon.classList.remove('text-gray-400');
                    currentHeartIcon.classList.add('text-red-500');
                } else {
                    state.hearts = Math.max(0, state.hearts - 1);
                    delete state.favoriteIds[svc.id];
                    currentHeartIcon.classList.add('text-gray-400');
                    currentHeartIcon.classList.remove('text-red-500');
                }
                updateCounters();
                saveState();
            }
            if (el.searchBar.value.trim() !== '') {
                filterAndRender();
            }
        });

        // --- Copy Event ---
        cardElement.querySelector('[data-role="copyBtn"]').addEventListener('click', () => {
            navigator.clipboard.writeText(svc.number)
                .then(() => {
                    state.copies += 1;
                    updateCounters();
                    saveState();
                })
                .catch(() => alert('Copy failed. Please copy manually: ' + svc.number));
        });

        // --- Call Event ---
        cardElement.querySelector('[data-role="callBtn"]').addEventListener('click', () => {
            window.location.href = 'tel:' + svc.number;

            const when = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            state.history.unshift({ title: svc.title, number: svc.number, time: when });

            if (state.history.length > 5) {
                state.history.pop();
            }
            renderHistory();
            saveState();
        });

        // ⭐⭐ Map Button Event ⭐⭐
        const mapBtn = cardElement.querySelector('[data-role="mapBtn"]');
        mapBtn.addEventListener('click', () => {
            const lat = svc.lat;
            const lng = svc.lng;
            if (lat && lng) {
                // Google Maps URL তৈরি
                const mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                window.open(mapUrl, '_blank');
            } else {
                alert(`দুঃখিত, "${svc.title}" এর লোকেশন ডেটা এখন যোগ করা হয়নি।`);
            }
        });
    }

    /**
     * Call History রেন্ডার করে
     */
    function renderHistory() {
        el.historyList.innerHTML = '';
        state.history.forEach(h => {
            const li = document.createElement('li');
            li.className = 'flex items-center justify-between gap-3 bg-white rounded-xl border p-3 shadow-sm hover:shadow-lg transition-all duration-300 ease-in-out cursor-pointer';
            li.innerHTML = `
        <div>
          <div class="font-semibold text-lg text-black leading-tight">${h.title}</div>
          <div class="text-sm text-black">${h.number}</div>
        </div>
        <div class="text-sm text-gray-500">${h.time}</div>
      `;
            li.addEventListener('click', () => {
                window.location.href = 'tel:' + h.number;
            });
            el.historyList.appendChild(li);
        });
    }

    /**
     * গ্লোবাল UI ইভেন্ট হ্যান্ডলার যুক্ত করে (যেমন: ক্লিয়ার হিস্টরি, সার্চ)
     */
    function bindGlobalUI() {
        el.clearHistory.addEventListener('click', () => {
            state.history = [];
            renderHistory();
            saveState();
        });
        el.searchBar.addEventListener('input', filterAndRender);
    }

    /**
     * Heart এবং Copy কাউন্টার আপডেট করে
     */
    function updateCounters() {
        el.heartCount.textContent = state.hearts;
        el.copyCount.textContent = state.copies;
    }

    // --- সার্ভিসের সম্পূর্ণ এবং সর্বশেষ তালিকা (Coordinates যুক্ত করা হয়েছে) ---
    function getServices() {
        return [
            // --- জাতীয় জরুরি নম্বর ---
            { id: 1, title: 'National Emergency Number', subtitle: 'জাতীয় জরুরি সেবা (পুলিশ/অ্যাম্বুলেন্স/ফায়ার)', number: '999', category: 'All', icon: './assets/emergency.png', lat: 24.3686, lng: 88.6300 }, // RMP (Approx)

            // ⭐ নতুন যুক্ত করা কার্ড ১ (ফায়ার সার্ভিস):
            { id: 2, title: 'Fire Service Hotline (General)', subtitle: 'জাতীয় ফায়ার সার্ভিস (ফায়ার/অ্যাম্বুলেন্স)', number: '102', category: 'All', icon: './assets/fire-service.png', lat: 24.3828, lng: 88.6019 }, // RSH Fire Station

            // ⭐ নতুন যুক্ত করা কার্ড ২ (সরকারি তথ্য ও সেবা):
            { id: 3, title: 'Information Service (a2i)', subtitle: 'সরকারি তথ্য ও সেবা (a2i)', number: '333', category: 'All', icon: './assets/emergency.png', lat: 24.3638, lng: 88.6254 }, // City Corp (Approx)

            { id: 4, title: 'Women & Child Helpline', subtitle: 'নারী ও শিশু সহায়তা', number: '109', category: 'Help', icon: './assets/emergency.png' },


            // --- রাজশাহী অঞ্চলের অফিসিয়াল নম্বর ---
            { id: 10, title: 'RMP Control Room', subtitle: 'রাজশাহী মেট্রোপলিটন পুলিশ', number: '0721-774476', category: 'Rajshahi Police', icon: './assets/police.png', lat: 24.3686, lng: 88.6300 },
            { id: 11, title: 'Rajshahi Fire Service', subtitle: 'ডিভিশনাল কন্ট্রোল রুম', number: '01730-336655', category: 'Rajshahi Fire', icon: './assets/fire-service.png', lat: 24.3828, lng: 88.6019 },
            { id: 12, title: 'Rajshahi Medical College (Emergency)', subtitle: 'জরুরি বিভাগ (হসপিটাল)', number: '0721-772150', category: 'Rajshahi Health', icon: './assets/ambulance.png', lat: 24.3725, lng: 88.6045 },
            { id: 13, title: 'Civil Surgeon Office', subtitle: 'জেলা স্বাস্থ্য তত্ত্বাবধান', number: '0721-775678', category: 'Rajshahi Health', icon: './assets/emergency.png' },
            { id: 14, title: 'Rajshahi City Corp. Hotline', subtitle: 'সিটি কর্পোরেশন সেবা', number: '16105', category: 'Rajshahi Govt.', icon: './assets/emergency.png', lat: 24.3638, lng: 88.6254 },
            { id: 15, title: 'Rajshahi Palli Bidyut (RBS)', subtitle: 'পবিস সদর দপ্তর হটলাইন', number: '01769401764', category: 'Rajshahi Electricity', icon: './assets/emergency.png' },
            { id: 16, title: 'Islami Bank Hospital RSH', subtitle: 'ইসলামী ব্যাংক হাসপাতাল', number: '0721-770965', category: 'Rajshahi Health', icon: './assets/ambulance.png', lat: 24.3682, lng: 88.5835 },

            // --- রাজশাহীর ব্লাড ব্যাংকসমূহ ---
            { id: 201, title: 'Rajshahi Blood Bank & Transfusion Center', subtitle: 'ব্লাড ব্যাংক ও ট্রান্সফিউশন সেন্টার', number: '01770-807108', category: 'Rajshahi Blood', icon: './assets/ambulance.png' },
            { id: 202, title: 'New Safe Blood Bank', subtitle: 'নিউ সেফ ব্লাড ব্যাংক', number: '01740-384078', category: 'Rajshahi Blood', icon: './assets/ambulance.png' },
            { id: 203, title: 'Blood Bank, RMC (Shandhani)', subtitle: 'রাজশাহী মেডিকেল কলেজ (সন্ধানী)', number: '01797-563375', category: 'Rajshahi Blood', icon: './assets/ambulance.png', lat: 24.3725, lng: 88.6045 },
            { id: 204, title: 'Badhon, RC Unit (Rajshahi College)', subtitle: 'বাঁধন, আর সি ইউনিট (রাজশাহী কলেজ)', number: '01752-355202', category: 'Rajshahi Blood', icon: './assets/ambulance.png', lat: 24.3664, lng: 88.6015 },
            { id: 205, title: 'Shah Makhdum Blood Bank', subtitle: 'শাহ মখদুম ব্লাড ব্যাংক', number: '01775-748777', category: 'Rajshahi Blood', icon: './assets/ambulance.png' },
            { id: 206, title: 'Blood Bank, Red Crescent', subtitle: 'রেড ক্রিসেন্ট রাজশাহী সিটি ইউনিট', number: '01770-330400', category: 'Rajshahi Blood', icon: './assets/ambulance.png' },
            { id: 207, title: 'Mission Blood Bank', subtitle: 'মিশন হাসপাতাল, রাজশাহী', number: '01733-845247', category: 'Rajshahi Blood', icon: './assets/ambulance.png' },
            { id: 208, title: 'Badhon, RU Branch (Rajshahi University)', subtitle: 'বাঁধন, রু শাখা (রাজশাহী বিশ্ববিদ্যালয়)', number: '01764-998353', category: 'Rajshahi Blood', icon: './assets/ambulance.png', lat: 24.3752, lng: 88.6278 },

            // --- রাজশাহী জেলার থানার ওসির নম্বরসমূহ ---
            { id: 301, title: 'OC, Boalia Model Police Station', subtitle: 'বোয়ালিয়া মডেল থানা', number: '01320-061499', category: 'Rajshahi Police', icon: './assets/police.png', lat: 24.3695, lng: 88.6001 },
            { id: 302, title: 'OC, Motihar Thana', subtitle: 'মতিহার থানা', number: '01320-061623', category: 'Rajshahi Police', icon: './assets/police.png', lat: 24.3789, lng: 88.6360 },
            { id: 303, title: 'OC, Rajpara Thana', subtitle: 'রাজপাড়া থানা', number: '01320-061527', category: 'Rajshahi Police', icon: './assets/police.png', lat: 24.3615, lng: 88.5830 },
            // ... (বাকি পুলিশ স্টেশন স্থানাঙ্ক ছাড়া) ...
            { id: 304, title: 'OC, Kashiadanga Thana', subtitle: 'কাঁশিয়াডাঙ্গা থানা', number: '01320-061889', category: 'Rajshahi Police', icon: './assets/police.png' },
            { id: 305, title: 'OC, Chandrima Thana', subtitle: 'চন্দ্রিমা থানা', number: '01320-061555', category: 'Rajshahi Police', icon: './assets/police.png' },
            { id: 306, title: 'OC, Belpukur Thana', subtitle: 'বেলপুকুর থানা', number: '01320-061679', category: 'Rajshahi Police', icon: './assets/police.png' },
            { id: 307, title: 'OC, Karnhar Thana', subtitle: 'কর্ণহার থানা', number: '01320-061939', category: 'Rajshahi Police', icon: './assets/police.png' },
            { id: 308, title: 'OC, Airport Thana', subtitle: 'এয়ারপোর্ট থানা', number: '01320-061781', category: 'Rajshahi Police', icon: './assets/police.png' },
            { id: 309, title: 'OC, Shah Makhdum Thana', subtitle: 'শাহ মখদুম থানা', number: '01320-061753', category: 'Rajshahi Police', icon: './assets/police.png' },
            { id: 310, title: 'OC, Poba Thana', subtitle: 'পবা থানা', number: '01320-061809', category: 'Rajshahi Police', icon: './assets/police.png' },
            { id: 311, title: 'OC, Katakhali Thana', subtitle: 'কাটাখালী থানা', number: '01320-061651', category: 'Rajshahi Police', icon: './assets/police.png' },
            { id: 312, title: 'OC, Damkura Thana', subtitle: 'দামকুড়া থানা', number: '01320-061911', category: 'Rajshahi Police', icon: './assets/police.png' },
            { id: 313, title: 'OC, Puthia Police Station', subtitle: 'পুঠিয়া থানা', number: '01320-122672', category: 'Rajshahi Police', icon: './assets/police.png' },
            { id: 314, title: 'OC, Tanore Police Station', subtitle: 'তানোর থানা', number: '01320-122620', category: 'Rajshahi Police', icon: './assets/police.png' },
            { id: 315, title: 'OC, Mohanpur Police Station', subtitle: 'মোহনপুর থানা', number: '01320-122646', category: 'Rajshahi Police', icon: './assets/police.png' },
            { id: 316, title: 'OC, Bagmara Police Station', subtitle: 'বাগমারা থানা', number: '01320-122698', category: 'Rajshahi Police', icon: './assets/police.png' },
            { id: 317, title: 'OC, Bagha Police Station', subtitle: 'বাঘা থানা', number: '01320-122724', category: 'Rajshahi Police', icon: './assets/police.png' },
            { id: 318, title: 'OC, Charghat Model Police Station', subtitle: 'চারঘাট মডেল থানা', number: '01320-122750', category: 'Rajshahi Police', icon: './assets/police.png' },
            { id: 319, title: 'OC, Durgapur Police Station', subtitle: 'দুর্গাপুর থানা', number: '01320-122724 (Alt)', category: 'Rajshahi Police', icon: './assets/police.png' },

            // --- রাজশাহী অ্যাম্বুলেন্স সার্ভিস ---
            { id: 401, title: 'Rajshahi Ambulance Service (24/7)', subtitle: '২৪ ঘণ্টা অ্যাম্বুলেন্স সার্ভিস', number: '01601-129376', category: 'Rajshahi Ambulance', icon: './assets/ambulance.png' },
            { id: 402, title: 'Islami Bank Hospital Ambulance', subtitle: 'ইসলামী ব্যাংক হাসপাতাল অ্যাম্বুলেন্স', number: '01719-978197', category: 'Rajshahi Ambulance', icon: './assets/ambulance.png', lat: 24.3682, lng: 88.5835 },
            { id: 403, title: 'Barind Medical College Hospital Ambulance', subtitle: 'বরেন্দ্র মেডিকেল কলেজ হাসপাতাল অ্যাম্বুলেন্স', number: '01772-564445', category: 'Rajshahi Ambulance', icon: './assets/ambulance.png', lat: 24.3595, lng: 88.5891 },
            { id: 404, title: 'CDM Ambulance Service', subtitle: 'সিডিএম অ্যাম্বুলেন্স সার্ভিস, লক্ষ্মীপুর', number: '01845-988898', category: 'Rajshahi Ambulance', icon: './assets/ambulance.png' },
            { id: 405, title: 'Rajshahi Medical College Hospital Ambulance', subtitle: 'রামেক হাসপাতাল অ্যাম্বুলেন্স', number: '0721-774335', category: 'Rajshahi Ambulance', icon: './assets/ambulance.png', lat: 24.3725, lng: 88.6045 },
            { id: 406, title: 'Ambulance Service (Private)', subtitle: 'সাধারণ অ্যাম্বুলেন্স (আগের নম্বর)', number: '01994-999999', category: 'Rajshahi Ambulance', icon: './assets/ambulance.png' },



            // --- হাসপাতাল ও ক্লিনিক ---

            { id: 500, title: 'Luxmipi Diagnostic Centre', subtitle: 'সকল টেস্টে ২৫% ছাড়! নির্ভুল রোগ নির্ণয়ে বিশ্বস্ত প্রতিষ্ঠান।', number: '01860280614', category: 'Rajshahi Hospital', icon: './assets/ambulance.png' },
            { id: 501, title: 'Rajshahi Medical College Hospital (RMC)', subtitle: 'রাজশাহী মেডিকেল কলেজ হাসপাতাল (মূল)', number: '0721-774335', category: 'Rajshahi Hospital', icon: './assets/ambulance.png', lat: 24.3725, lng: 88.6045 },
            { id: 502, title: 'Islami Bank Medical College Hospital', subtitle: 'ইসলামী ব্যাংক মেডিকেল কলেজ হাসপাতাল', number: '01711340582', category: 'Rajshahi Hospital', icon: './assets/ambulance.png', lat: 24.3682, lng: 88.5835 },
            { id: 503, title: 'Rajshahi Model Hospital', subtitle: 'রাজশাহী মডেল হাসপাতাল', number: '01773-844844', category: 'Rajshahi Hospital', icon: './assets/ambulance.png' },
            { id: 504, title: 'Popular Diagnostic Center Ltd.', subtitle: 'পপুলার ডায়াগনস্টিক সেন্টার', number: '09613787811', category: 'Rajshahi Clinic', icon: './assets/ambulance.png', lat: 24.3722, lng: 88.6059 },
            { id: 505, title: 'Bangladesh Eye Hospital', subtitle: 'বাংলাদেশ আই হাসপাতাল', number: '09643123123', category: 'Rajshahi Clinic', icon: './assets/ambulance.png' },
            { id: 506, title: 'LABAID Diagnostic Center', subtitle: 'ল্যাবএইড ডায়াগনস্টিক সেন্টার', number: '01766-661144', category: 'Rajshahi Clinic', icon: './assets/ambulance.png', lat: 24.3719, lng: 88.6049 },
            { id: 507, title: 'Rajshahi City Hospital', subtitle: 'রাজশাহী সিটি হাসপাতাল', number: '01318-245082', category: 'Rajshahi Hospital', icon: './assets/ambulance.png' },
            { id: 508, title: 'Rajshahi Royal Hospital & Diagnostic Center', subtitle: 'রাজশাহী রয়্যাল হাসপাতাল', number: '01762-685090', category: 'Rajshahi Hospital', icon: './assets/ambulance.png' },
            { id: 509, title: 'Amana Hospital Ltd.', subtitle: 'আমেনা হাসপাতাল', number: '01705-403610', category: 'Rajshahi Hospital', icon: './assets/ambulance.png' },
            { id: 510, title: 'Rajshahi Shishu Hospital', subtitle: 'রাজশাহী শিশু হাসপাতাল', number: '0721770506', category: 'Rajshahi Hospital', icon: './assets/ambulance.png' },
            { id: 511, title: 'Ibn Sina Diagnostic & Consultation Center', subtitle: 'ইবনে সিনা ডায়াগনস্টিক', number: '09610009636', category: 'Rajshahi Clinic', icon: './assets/ambulance.png', lat: 24.3670, lng: 88.5999 },
            { id: 512, title: 'Dolphin Clinic', subtitle: 'ডলফিন ক্লিনিক', number: '01723-025514', category: 'Rajshahi Clinic', icon: './assets/ambulance.png' },
            { id: 513, title: 'Dr. Kaisar Rahman Chowdhury Hospital', subtitle: 'ডা. কায়সার রহমান চৌধুরী হাসপাতাল', number: '01711-994292', category: 'Rajshahi Hospital', icon: './assets/ambulance.png' },
            { id: 514, title: 'Kaisar Memorial Hospital', subtitle: 'কায়সার মেমোরিয়াল হাসপাতাল', number: '01711-484006', category: 'Rajshahi Hospital', icon: './assets/ambulance.png' },
            { id: 515, title: 'Rajshahi Royal Hospital (Main Line)', subtitle: 'রাজশাহী রয়্যাল হাসপাতাল (অফিস)', number: '0721-771277', category: 'Rajshahi Hospital', icon: './assets/ambulance.png' },

            // --- ব্যাংক ---
            { id: 701, title: 'Sonali Bank, Main Branch', subtitle: 'সোনালী ব্যাংক, প্রধান শাখা, রাজশাহী', number: '0721-772123', category: 'Rajshahi Bank', icon: './assets/emergency.png' },
            { id: 702, title: 'Islami Bank, Main Branch', subtitle: 'ইসলামী ব্যাংক, স্টেশন রোড শাখা', number: '0721-775681', category: 'Rajshahi Bank', icon: './assets/emergency.png' },
            { id: 703, title: 'Dutch-Bangla Bank, Main Branch', subtitle: 'ডাচ-বাংলা ব্যাংক, সাহেব বাজার', number: '0721-771191', category: 'Rajshahi Bank', icon: './assets/emergency.png' },
            { id: 704, title: 'Agrani Bank, Main Branch', subtitle: 'অগ্রণী ব্যাংক, প্রধান শাখা, রাজশাহী', number: '0721-775260', category: 'Rajshahi Bank', icon: './assets/emergency.png' },

            // --- রাজশাহী শিক্ষা বোর্ড ও সংশ্লিষ্ট যোগাযোগ ---
            { id: 601, title: 'Rajshahi Education Board (General)', subtitle: 'শিক্ষা বোর্ড (সাধারণ)', number: '0721-776270', category: 'Rajshahi Education', icon: './assets/emergency.png', lat: 24.3601, lng: 88.6250 },
            // ... (বাকি শিক্ষা বোর্ড স্থানাঙ্ক ছাড়া) ...
            { id: 602, title: 'REB Chairman Office', subtitle: 'শিক্ষা বোর্ড চেয়ারম্যানের অফিস', number: '0247811994', category: 'Rajshahi Education', icon: './assets/emergency.png' },
            { id: 603, title: 'REB Chief Evaluation Officer', subtitle: 'প্রধান মূল্যায়ন অফিসার (মোবাইল)', number: '01670226000', category: 'Rajshahi Education', icon: './assets/emergency.png' },
            { id: 604, title: 'REB Public Relations Officer', subtitle: 'গণসংযোগ অফিসার (মোবাইল)', number: '01755023329', category: 'Rajshahi Education', icon: './assets/emergency.png' },
            { id: 605, title: 'Rajshahi Cantonment Board School & College', subtitle: 'ক্যান্টনমেন্ট বোর্ড স্কুল ও কলেজ', number: '01309126445', category: 'Rajshahi Education', icon: './assets/emergency.png' },
            { id: 606, title: 'REB Model School & College', subtitle: 'শিক্ষা বোর্ড মডেল স্কুল ও কলেজ', number: '0721-771234', category: 'Rajshahi Education', icon: './assets/emergency.png' },
        ];
    }
    // --- End getServices ---

    // --- Initialization ---

    init();
})();