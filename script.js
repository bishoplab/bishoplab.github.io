const apiKey = "7a5c846dc5771fe34d62b02ab2f31c4d"; // Replace with your Scopus API key
const authorIds = ["57196098200", "7401913619", "57426146300", "23501819100"]; // Replace with actual Scopus author IDs
const topics = ["Mitochondrion", "Skeletal Muscle", "Circadian Rhythm", "Resistance Training", "Endurance", "Carbohydrate"];
let publications = [];
let visiblePublications = 20;

// Initialize dropdown filter
document.getElementById("topicFilter").innerHTML = topics.map(topic => `<option value="${topic}">${topic}</option>`).join('');

document.getElementById("topicFilter").addEventListener("change", filterPublications);

async function fetchPublications() {
    try {
        let allPublications = [];
        for (const authorId of authorIds) {
            const response = await fetch(`https://api.elsevier.com/content/search/scopus?query=AU-ID(${authorId})&apiKey=${apiKey}&count=100&sort=-date`);
            const data = await response.json();
            if (data['search-results'] && data['search-results']['entry']) {
                allPublications.push(...data['search-results']['entry']);
            }
        }
        publications = allPublications;
        displayPublications();
    } catch (error) {
        console.error("Error fetching data from Scopus API", error);
        document.getElementById("publications").innerHTML = "<p>Failed to load publications.</p>";
    }
}

function displayPublications() {
    const container = document.getElementById("publications");
    container.innerHTML = "";
    
    let filteredPublications = publications.slice(0, visiblePublications);
    
    filteredPublications.forEach(pub => {
        const title = pub["dc:title"] || "Untitled";
        const year = pub["prism:coverDate"]?.split("-")[0] || "N/A";
        const journal = pub["prism:publicationName"] || "N/A";
        const link = pub["prism:doi"] ? `https://doi.org/${pub["prism:doi"]}` : "#";
        
        const pubDiv = document.createElement("div");
        pubDiv.classList.add("publication");
        pubDiv.innerHTML = `
            <h3 style="margin-top: 5px;"><a href="${link}" target="_blank">${title}</a></h3>
            <p><strong>Year:</strong> ${year}</p>
            <p><strong>Journal:</strong> ${journal}</p>
        `;
        container.appendChild(pubDiv);
    });
}

function filterPublications() {
    const selectedTopic = document.getElementById("topicFilter").value.toLowerCase();
    
    if (selectedTopic) {
        publications = publications.filter(pub => pub["dc:title"].toLowerCase().includes(selectedTopic));
    }
    visiblePublications = 20;
    displayPublications();
}

window.addEventListener("scroll", () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        visiblePublications += 20;
        displayPublications();
    }
});

fetchPublications();

