const API_KEY = "7a5c846dc5771fe34d62b02ab2f31c4d"; // Replace with Elsevier API Key
const scopusIds = ["57196098200", "7401913619", "57426146300", "23501819100"]; // Replace with actual Scopus Author IDs

let allPublications = [];
let filteredPublications = [];
let loadedCount = 0;
const loadStep = 20;

// Predefined topics for filtering
const topics = ["Mitochondrion", "Skeletal Muscle", "Circadian Rhythm", "Resistance Training", "Endurance", "Carbohydrate"];

// Populate dropdown with topics
function createFilterDropdown() {
    const filterContainer = document.getElementById("filter-container");
    const dropdown = document.createElement("select");
    dropdown.id = "topicFilter";
    dropdown.innerHTML = `<option value="all">All Topics</option>` + 
        topics.map(topic => `<option value="${topic}">${topic}</option>`).join("");

    dropdown.addEventListener("change", filterPublications);
    filterContainer.appendChild(dropdown);
}

// Fetch publications from Scopus API
async function fetchScopusPublications(authorId) {
    const url = `https://api.elsevier.com/content/search/scopus?query=AU-ID(${authorId})&apiKey=${API_KEY}&httpAccept=application/json&count=100`;

    try {
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) throw new Error(`Scopus API error: ${response.status}`);

        const data = await response.json();
        const entries = data?.["search-results"]?.entry || [];

        return entries.map(entry => ({
            title: entry["dc:title"] || "Untitled",
            year: entry["prism:coverDate"]?.split("-")[0] || "N/A",
            journal: entry["prism:publicationName"] || "N/A",
            doi: entry["prism:doi"] || "#",
            eid: entry["eid"]
        }));
    } catch (error) {
        console.warn(`Scopus fetch failed for Author ID: ${authorId}`, error);
        return [];
    }
}

// Fetch authors from Scopus API
async function fetchAuthors(eid) {
    const url = `https://api.elsevier.com/content/abstract/eid/${eid}?apiKey=${API_KEY}&httpAccept=application/json`;

    try {
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) throw new Error(`Scopus API error: ${response.status}`);

        const data = await response.json();
        const authors = data?.["abstracts-retrieval-response"]?.["authors"]?.["author"] || [];
        const keywords = data?.["abstracts-retrieval-response"]?.["authkeywords"] || [];

        return {
            authors: authors.map(author => ({
                name: `${author["ce:given-name"]} ${author["ce:surname"]}`,
                scopusId: author["@auid"]
            })),
            topics: keywords.map(k => k.toLowerCase())
        };
    } catch (error) {
        console.warn(`Author fetch failed for EID: ${eid}`, error);
        return { authors: [], topics: [] };
    }
}

// Fetch all publications and store in allPublications
async function fetchPublications(scopusIds) {
    document.getElementById("publications").innerHTML = "<p>Loading publications...</p>";
    const publicationsMap = new Map();

    for (const authorId of scopusIds) {
        const publications = await fetchScopusPublications(authorId);

        for (const pub of publications) {
            const key = `${pub.title}_${pub.year}`;

            if (!publicationsMap.has(key)) {
                const pubDetails = await fetchAuthors(pub.eid);
                pub.authors = pubDetails.authors;
                pub.topics = pubDetails.topics;
                publicationsMap.set(key, pub);
            } else {
                let existing = publicationsMap.get(key);
                const newAuthors = (await fetchAuthors(pub.eid)).authors;
                existing.authors = [...existing.authors, ...newAuthors]; 
                publicationsMap.set(key, existing);
            }
        }
    }

    allPublications = Array.from(publicationsMap.values())
        .filter(pub => pub.year !== "N/A")  // Exclude invalid years
        .sort((a, b) => parseInt(b.year) - parseInt(a.year)); // Sort newest to oldest

    filteredPublications = [...allPublications];

    document.getElementById("publications").innerHTML = "";
    if (allPublications.length === 0) {
        document.getElementById("publications").innerHTML = "<p>No publications found.</p>";
        return;
    }

    loadMorePublications();
}

// Filter publications based on selected topic
function filterPublications() {
    const selectedTopic = document.getElementById("topicFilter").value.toLowerCase();

    if (selectedTopic === "all") {
        filteredPublications = [...allPublications];
    } else {
        filteredPublications = allPublications.filter(pub => pub.topics.includes(selectedTopic));
    }

    loadedCount = 0;
    document.getElementById("publications").innerHTML = "";
    loadMorePublications();
}

// Load more publications on scroll
function loadMorePublications() {
    const publicationsContainer = document.getElementById("publications");

    for (let i = loadedCount; i < loadedCount + loadStep && i < filteredPublications.length; i++) {
        const pub = filteredPublications[i];

        const authorList = Array.from(new Set(pub.authors.map(a => a.name)));
        const formattedAuthors = authorList
            .map(name => {
                const authorObj = pub.authors.find(a => a.name === name);
                return scopusIds.includes(authorObj?.scopusId) ? `<strong>${name}</strong>` : name;
            })
            .join(", ");

        const publicationDiv = document.createElement("div");
        publicationDiv.classList.add("publication");

        publicationDiv.innerHTML = `
            <h3 style="font-size: 14px; margin: 5px 0;">
                <a href="https://doi.org/${pub.doi}" target="_blank" style="text-decoration: none; color: #0077cc;">${pub.title}</a>
            </h3>
            <p style="font-size: 12px; margin: 2px 0;"><strong>Year:</strong> ${pub.year}</p>
            <p style="font-size: 12px; margin: 2px 0;"><strong>Journal:</strong> ${pub.journal}</p>
            <p style="font-size: 12px; margin: 2px 0;"><strong>Authors:</strong> ${formattedAuthors}</p>
        `;

        publicationsContainer.appendChild(publicationDiv);
    }

    loadedCount += loadStep;
}

// Load more when user scrolls near bottom
function handleScroll() {
    const scrollPosition = window.innerHeight + window.scrollY;
    const documentHeight = document.body.offsetHeight;

    if (scrollPosition >= documentHeight - 100) { 
        loadMorePublications();
    }
}

window.addEventListener("scroll", handleScroll);

// Initialize
createFilterDropdown();
fetchPublications(scopusIds);


fetchPublications();

