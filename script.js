const SCOPUS_API_KEY = "7a5c846dc5771fe34d62b02ab2f31c4d"; 
const scopusIds = ["57196098200", "7401913619", "57426146300", "23501819100"]; // Replace with actual Scopus Author IDs
const topics = ["Mitochondrion", "Skeletal Muscle", "Circadian Rhythm", "Resistance Training", "Endurance", "Carbohydrate"];

let allPublications = [];
let filteredPublications = [];
let loadedCount = 0;
const loadStep = 20;
let selectedTopic = null;

async function fetchScopusPublications() {
    document.getElementById("publications").innerHTML = "<p>Loading publications...</p>";
    
    const url = `https://api.elsevier.com/content/search/scopus?query=AU-ID(${scopusIds.join(' OR ')})&apiKey=${SCOPUS_API_KEY}&httpAccept=application/json&sort=+coverDate`;
    
    try {
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) throw new Error(`Scopus API error: ${response.status}`);
        
        const data = await response.json();
        const entries = data["search-results"]?.entry || [];

        allPublications = entries.map(entry => ({
            title: entry["dc:title"] || "Untitled",
            year: entry["prism:coverDate"]?.split("-")[0] || "N/A",
            journal: entry["prism:publicationName"] || "N/A",
            doi: entry["prism:doi"] || null,
            eid: entry["eid"],
            keywords: entry["authkeywords"] ? entry["authkeywords"].split(", ") : []
        })).sort((a, b) => parseInt(b.year) - parseInt(a.year));
        
        applyFilter();
    } catch (error) {
        console.error("Scopus fetch failed", error);
    }
}

function applyFilter() {
    filteredPublications = selectedTopic
        ? allPublications.filter(pub => pub.keywords.includes(selectedTopic))
        : allPublications;

    loadedCount = 0;
    document.getElementById("publications").innerHTML = "";
    loadMorePublications();
}

function loadMorePublications() {
    const publicationsContainer = document.getElementById("publications");

    for (let i = loadedCount; i < loadedCount + loadStep && i < filteredPublications.length; i++) {
        const pub = filteredPublications[i];
        const publicationDiv = document.createElement("div");
        publicationDiv.classList.add("publication");

        publicationDiv.innerHTML = `
            <h3 style="font-size: 14px; margin: 0 0 5px;">
                <a href="https://doi.org/${pub.doi}" target="_blank" style="text-decoration: none; color: #0077cc;">${pub.title}</a>
            </h3>
            <p style="font-size: 12px; margin: 2px 0;"><strong>Year:</strong> ${pub.year}</p>
            <p style="font-size: 12px; margin: 2px 0;"><strong>Journal:</strong> ${pub.journal}</p>
        `;

        publicationsContainer.appendChild(publicationDiv);
    }

    loadedCount += loadStep;
}

function handleScroll() {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        loadMorePublications();
    }
}

function createDropdown() {
    const filterContainer = document.getElementById("filter");
    const dropdown = document.createElement("select");
    dropdown.innerHTML = `
        <option value="">All Topics</option>
        ${topics.map(topic => `<option value="${topic}">${topic}</option>`).join("")}
    `;

    dropdown.addEventListener("change", event => {
        selectedTopic = event.target.value || null;
        applyFilter();
    });
    
    filterContainer.appendChild(dropdown);
}

window.addEventListener("scroll", handleScroll);
document.addEventListener("DOMContentLoaded", () => {
    createDropdown();
    fetchScopusPublications();
});

