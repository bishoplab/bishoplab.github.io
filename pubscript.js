const API_KEY = '7a5c846dc5771fe34d62b02ab2f31c4d'; // Replace with your Elsevier API Key
const scopusIds = ["57196098200", "7401913619", "57426146300", "23501819100"]; // Replace with actual Scopus Author IDs

let allPublications = [];
let loadedCount = 0;
const loadStep = 30; // Number of publications to load initially & on scroll
let filteredPublications = []; // Stores the filtered publications

// Function to fetch publications from Scopus API
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
            eid: entry["eid"],
            keywords: entry["authkeywords"] || [] // Assume keywords are available
        }));
    } catch (error) {
        console.warn(`Scopus fetch failed for Author ID: ${authorId}`, error);
        return [];
    }
}

// Function to fetch authors associated with the publication
async function fetchAuthors(eid) {
    const url = `https://api.elsevier.com/content/abstract/eid/${eid}?apiKey=${API_KEY}&httpAccept=application/json`;

    try {
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) throw new Error(`Scopus API error: ${response.status}`);

        const data = await response.json();
        const authors = data?.["abstracts-retrieval-response"]?.["authors"]?.["author"] || [];

        return authors.map(author => ({
            name: `${author["ce:given-name"]} ${author["ce:surname"]}`,
            scopusId: author["@auid"]
        }));
    } catch (error) {
        console.warn(`Author fetch failed for EID: ${eid}`, error);
        return [];
    }
}

// Function to fetch all publications and store them
async function fetchPublications(scopusIds) {
    document.getElementById("publications").innerHTML = "<p>Loading publications...</p>";
    const publicationsMap = new Map();

    for (const authorId of scopusIds) {
        const publications = await fetchScopusPublications(authorId);

        for (const pub of publications) {
            const key = `${pub.title}_${pub.year}`;

            if (!publicationsMap.has(key)) {
                pub.authors = await fetchAuthors(pub.eid);
                publicationsMap.set(key, pub);
            } else {
                let existing = publicationsMap.get(key);
                const newAuthors = await fetchAuthors(pub.eid);
                existing.authors = [...existing.authors, ...newAuthors];
                publicationsMap.set(key, existing);
            }
        }
    }

    allPublications = Array.from(publicationsMap.values())
        .filter(pub => pub.year !== "N/A")  // Ensure we exclude "N/A" years from sorting
        .sort((a, b) => parseInt(b.year) - parseInt(a.year)); // Sort from newest to oldest

    document.getElementById("publications").innerHTML = "";

    if (allPublications.length === 0) {
        document.getElementById("publications").innerHTML = "<p>No publications found.</p>";
        return;
    }

    filteredPublications = allPublications; // Initialize filtered list
    loadMorePublications();
}

// Function to load more publications, based on filtered results
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
            <h3 style="font-size: 14px; margin: 0 0 5px;">
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

// Function to handle keyword filter selection
document.getElementById("keywordFilter").addEventListener("change", (event) => {
    const selectedKeyword = event.target.value.toLowerCase();
    
    if (selectedKeyword) {
        filteredPublications = allPublications.filter(pub => 
            pub.keywords.some(keyword => keyword.toLowerCase().includes(selectedKeyword)) ||
            pub.title.toLowerCase().includes(selectedKeyword)
        );
    } else {
        filteredPublications = allPublications; // No filter, show all publications
    }

    loadedCount = 0; // Reset loaded count for filtered results
    document.getElementById("publications").innerHTML = ""; // Clear the publications container
    loadMorePublications(); // Reload filtered publications
});

// Function to set up infinite scroll
function setupInfiniteScroll() {
    window.onscroll = function() {
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollPosition = window.innerHeight + window.scrollY;

        // If scrolled near bottom of page
        if (scrollHeight - scrollPosition < 100) {
            if (loadedCount < filteredPublications.length) {
                loadMorePublications();
            }
        }
    };
}

// Call fetchPublications initially with the scopusIds array
fetchPublications(scopusIds);

// Call setupInfiniteScroll to enable the infinite scrolling feature
setupInfiniteScroll();
