const API_KEY = "7a5c846dc5771fe34d62b02ab2f31c4d"; // Replace with your Elsevier API Key

// List of Scopus Author IDs to pull from
const scopusIds = ["57196098200", "7401913619"]; // Replace with actual Scopus Author IDs

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
            eid: entry["eid"] // Unique Scopus ID for fetching full author list
        }));
    } catch (error) {
        console.warn(`Scopus fetch failed for Author ID: ${authorId}`, error);
        return [];
    }
}

async function fetchAuthors(eid) {
    const url = `https://api.elsevier.com/content/abstract/eid/${eid}?apiKey=${API_KEY}&httpAccept=application/json`;

    try {
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) throw new Error(`Scopus API error: ${response.status}`);

        const data = await response.json();
        const authors = data?.["abstracts-retrieval-response"]?.["authors"]?.["author"] || [];

        return authors.map(author => ({
            name: `${author["ce:given-name"]} ${author["ce:surname"]}`,
            scopusId: author["@auid"] // Scopus Author ID
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
                existing.authors = [...existing.authors, ...newAuthors]; // Merge author lists
                publicationsMap.set(key, existing);
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
        const authorList = Array.from(new Set(pub.authors.map(a => a.name))); // Unique author names

        // Bold the authors found in the provided Scopus IDs
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
    });
}

// Load publications on page load
fetchPublications(scopusIds);
