async function fetchPublications() {
    const orcidId = "0000-0002-6956-9188"; // Replace with your ORCID ID
    const url = `https://pub.orcid.org/v3.0/${orcidId}/works`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' } // Request JSON format
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const publications = data.group;

        const publicationsContainer = document.getElementById('publications');
        publicationsContainer.innerHTML = ''; // Clear previous content

        publications.forEach(publication => {
            const workSummary = publication['work-summary'][0];

            const title = workSummary?.title?.title?.value || "Untitled";
            const year = workSummary?.['publication-date']?.year?.value || "N/A";
            const journal = workSummary?.['journal-title']?.value || "N/A";

            // Extract DOI or first available external link
            let doi = "#";
            const externalIds = workSummary?.['external-ids']?.['external-id'] || [];
            if (externalIds.length > 0) {
                doi = externalIds[0]?.['external-id-url']?.value || "#";
            }

            // Extract authors from contributors if available
            let authors = "Unknown";
            if (workSummary?.contributors?.contributor?.length > 0) {
                authors = workSummary.contributors.contributor.map(c => c['credit-name']?.value || "Unknown").join(', ');
            }

            // Create publication entry
            const publicationDiv = document.createElement('div');
            publicationDiv.classList.add('publication');

            publicationDiv.innerHTML = `
                <h3><a href="${doi}" target="_blank">${title}</a></h3>
                <p><strong>Year:</strong> ${year}</p>
                <p><strong>Journal:</strong> ${journal}</p>
                <p><strong>Authors:</strong> ${authors}</p>
            `;

            publicationsContainer.appendChild(publicationDiv);
        });

    } catch (error) {
        console.error('Error fetching data from ORCID API', error);
        document.getElementById('publications').innerHTML = '<p>Failed to load publications.</p>';
    }
}

// Load publications on page load
fetchPublications();

