const API_KEY = '7cd67f1576712652d3d4c314da1c31c5'; // Replace with your Elsevier API Key
const scopusIds = ["57196098200", "7401913619", "57426146300", "23501819100"]; // Replace with actual Scopus Author IDs

let allPublications = [];
let loadedCount = 0;
const loadStep = 30;
let filteredPublications = [];

async function fetchScopusPublications(authorId) {
    const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
    const query = `AU-ID(${authorId})`;
    const url = `https://api.elsevier.com/content/search/scopus?query=${encodeURIComponent(query)}&apiKey=${API_KEY}&httpAccept=application/json&count=100`;

    try {
        console.log("Fetching Scopus publications:", proxyUrl + url);
        const response = await fetch(proxyUrl + url, { method: "GET" });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Scopus API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const entries = data?.["search-results"]?.entry || [];

        return entries.map(entry => ({
            title: entry["dc:title"] || "Untitled",
            year: entry["prism:coverDate"]?.split("-")[0] || "N/A",
            journal: entry["prism:publicationName"] || "N/A",
            doi: entry["prism:doi"] || "#",
            eid: entry["eid"],
            keywords: entry["authkeywords"] || []
        }));
    } catch (error) {
        console.warn(`Scopus fetch failed for Author ID: ${authorId}`, error);
        return [];
    }
}

async function fetchAuthors(eid) {
    const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
    const url = `https://api.elsevier.com/content/abstract/eid/${eid}?apiKey=${API_KEY}&httpAccept=application/json`;

    try {
        console.log("Fetching authors:", proxyUrl + url);
        const response = await fetch(proxyUrl + url, { method: "GET" });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Scopus API error: ${response.status} - ${errorText}`);
        }

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
        .filter(pub => pub.year !== "N/A")
        .sort((a, b) => parseInt(b.year) - parseInt(a.year));

    document.getElementById("publications").innerHTML = "";

    if (allPublications.length === 0) {
        document.getElementById("publications").innerHTML = "<p>No publications found.</p>";
        return;
    }

    filteredPublications = allPublications;
    loadMorePublications();
}

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

document.getElementById("keywordFilter").addEventListener("change", (event) => {
    const selectedKeyword = event.target.value.toLowerCase();
    
    if (selectedKeyword) {
        filteredPublications = allPublications.filter(pub => 
            pub.keywords.some(keyword => keyword.toLowerCase().includes(selectedKeyword)) ||
            pub.title.toLowerCase().includes(selectedKeyword)
        );
    } else {
        filteredPublications = allPublications;
    }

    loadedCount = 0;
    document.getElementById("publications").innerHTML = "";
    loadMorePublications();
});

function setupInfiniteScroll() {
    window.onscroll = function() {
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollPosition = window.innerHeight + window.scrollY;

        if (scrollHeight - scrollPosition < 100) {
            if (loadedCount < filteredPublications.length) {
                loadMorePublications();
            }
        }
    };
}

fetchPublications(scopusIds);
setupInfiniteScroll();


