async function fetchCrossRefAuthors(doi) {
    if (!doi || doi === "#") return []; // Return empty array if no valid DOI

    const apiUrl = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`CrossRef error: ${response.status}`);

        const data = await response.json();
        const authorList = data?.message?.author || [];

        return authorList.map(author => author.given + " " + author.family).filter(name => name.trim() !== "");
    } catch (error) {
        console.error(`Failed to fetch authors for DOI: ${doi}`, error);
        return [];
    }
}

async function fetchPublications(orcidIds) {
    const publicationsMap = new Map(); // Deduplication storage

    for (const orcidId of orcidIds) {
        const url = `https://pub.orcid.org/v3.0/${orcidId}/works`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) throw new Error(`ORCID API error: ${response.status}`);

            const data = await response.json();
            const publications = data.group;

            for (const publication of publications) {
                const workSummary = publication['work-summary'][0];
                const title = workSummary?.title?.title?.value || "Untitled";
                const year = workSummary?.['publication-date']?.year?.value || "N/A";
                const journal = workSummary?.['journal-title']?.value || "N/A";

                // Extract DOI or first available external link
                let doi = "#";
                const externalIds = workSummary?.['external-ids']?.['external-id'] || [];
                for (const id of externalIds) {
                    if (id?.['external-id-type'] === "doi") {
                        doi = id?.['external-id-value'] || "#";
                        break;
                    }
                }

                // Fetch authors using CrossRef if DOI is available
                let authors = await fetchCrossRefAuthors(doi);

                // Fallback to ORCID author data if CrossRef returns nothing
                if (authors.length === 0) {
                    const contributors = workSummary?.contributors?.contributor || [];
                    authors = contributors.map(contributor => {
                        let authorName = contributor?.['credit-name']?.value || `ORCID: ${contributor?.['contributor-orcid']?.path || "Unknown"}`;
                        return authorName;
                    });
                }

                if (authors.length === 0) authors = ["Unknown"];

                // Highlight authors matching the ORCID list
                const highlightedAuthors = authors.map(name =>
                    orcidIds.some(id => name.includes(id)) ? `<strong>${name}</strong>` : name
                );

                // Generate unique key for deduplication
                const key = `${title}_${year}`;

                if (publicationsMap.has(key)) {
                    // Merge authors if duplicate
                    let existingData = publicationsMap.get(key);
                    existingData.authors = Array.from(new Set([...existingData.authors.split(", "), ...highlightedAuthors])).join(", ");
                    publicationsMap.set(key, existingData);
                } else {
                    publicationsMap.set(key, { title, year, journal, doi, authors: highlightedAuthors.join(", ") });
                }
            }
        } catch (error) {
            console.error('Error fetching data from ORCID API', error);
            document.getElementById('publications').innerHTML = '<p>Failed to load publications.</p>';
        }
    }

    // Display publications
    const publicationsContainer = document.getElementById('publications');
    publicationsContainer.innerHTML = ''; // Clear previous content

    publicationsMap.forEach(pub => {
        const publicationDiv = document.createElement('div');
        publicationDiv.classList.add('publication');

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

// List of ORCID IDs to pull from
const orcidList = ["0000-0002-6956-9188", "0000-0002-6011-7126"]; // Replace with actual ORCID IDs

// Load publications on page load
fetchPublications(orcidList);
