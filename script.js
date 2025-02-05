const API_KEY = "7a5c846dc5771fe34d62b02ab2f31c4d"; // Replace with your Elsevier API Key

async function fetchScopusPublications(authorId) {
    const url = `https://api.elsevier.com/content/search/scopus?query=AU-ID(${authorId})&apiKey=${API_KEY}&httpAccept=application/json`;

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
            authors: entry["dc:creator"] || "Unknown"
        }));
    } catch (error) {
        console.warn(`Scopus fetch failed for Author ID: ${authorId}`, error);
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

            if (publicationsMap.has(key)) {
                let existing = publicationsMap.get(key);
                existing.authors = Array.from(new Set([...existing.authors.split(", "), pub.authors])).join(", ");
                publicationsMap.set(key, existing);
            } else {
                publicationsMap.set(key, pub);
            }
        }
    }

    const publicationsContainer = document.getElementById("publications");
    publicationsContainer.innerHTML = "";

    if (publicationsMap.size === 0) {
        publicationsContainer.innerHTML = "<p>No publications found.</p>";
        return;
    }

    publicationsMap.forEach(pub => {
        const publicationDiv = document.createElement("div");
        publicationDiv.classList.add("publication");

        publicationDiv.innerHTML = `
            <h3 style="font-size: 16px; margin-bottom: 5px;">
                <a href="https://doi.org/${pub.doi}" target="_blank">${pub.title}</a>
            </h3>
            <p style="font-size: 14px; margin: 2px 0;"><strong>Year:</strong> ${pub.year}</p>
            <p style="font-size: 14px; margin: 2px 0;"><strong>Journal:</strong> ${pub.journal}</p>
            <p style="font-size: 14px; margin: 2px 0;"><strong>Authors:</strong> ${pub.authors}</p>
        `;

        publicationsContainer.appendChild(publicationDiv);
    });
}

// List of Scopus Author IDs to pull from
const scopusIds = ["7401913619", "57196098200"]; // Replace with actual Scopus Author IDs

// Load publications on page load
fetchPublications(scopusIds);
