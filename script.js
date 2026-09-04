/* ==========================================================================
       DATA CONTROLLER & PARSER
       ========================================================================== */
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_yIIAOieBArTnZJsRI-EgkeYp15kzD_-NTMhCw8QNocwwOO52NIj8vY6y5BOIOzQCscxy8t5bN9iA/pub?gid=1536848838&single=true&output=csv';

    let submissionsData = [];
    let state = {
      group: 'ALL',
      name: 'ALL',
      type: 'ALL',
      search: ''
    };

    // DOM Elements
    const groupSelect = document.getElementById('groupSelect');
    const nameSelect = document.getElementById('nameSelect');
    const typeSelect = document.getElementById('typeSelect');
    const searchInput = document.getElementById('searchInput');
    const stage = document.getElementById('dashboardStage');
    const refreshBtn = document.getElementById('refreshBtn');
    const lastUpdatedEl = document.getElementById('lastUpdated');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxVideo = document.getElementById('lightboxVideo');

    function initializePortfolio() {
      setupEventListeners();
      fetchData();
    }

    window.addEventListener('DOMContentLoaded', initializePortfolio);

    function setupEventListeners() {
      refreshBtn.addEventListener('click', fetchData);
      
      groupSelect.addEventListener('change', (e) => {
        state.group = e.target.value;
        state.name = 'ALL';
        updateNameDropdown();
        render();
      });

      nameSelect.addEventListener('change', (e) => {
        state.name = e.target.value;
        render();
      });

      typeSelect.addEventListener('change', (e) => {
        state.type = e.target.value;
        render();
      });

      searchInput.addEventListener('input', (e) => {
        state.search = e.target.value.toLowerCase().trim();
        render();
      });

      document.getElementById('lightboxClose').addEventListener('click', closeLightbox);

      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
      });
    }

    function goHome() {
      state = {
        group: 'ALL',
        name: 'ALL',
        type: 'ALL',
        search: ''
      };
      groupSelect.value = 'ALL';
      typeSelect.value = 'ALL';
      searchInput.value = '';
      updateNameDropdown();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* ==========================================================================
       DATA FETCHING & MULTI-LINK PARSING
       ========================================================================== */
    function fetchData() {
      refreshBtn.disabled = true;
      refreshBtn.innerText = "⏳ Loading...";

      Papa.parse(CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          refreshBtn.disabled = false;
          refreshBtn.innerText = "🔄 Refresh";
          
          const now = new Date();
          lastUpdatedEl.innerText = `Updated ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
          
          processRawData(results.data, results.meta.fields);
        },
        error: function(err) {
          refreshBtn.disabled = false;
          refreshBtn.innerText = "🔄 Retry";
          stage.innerHTML = `
            <div class="empty-state">
              <h3>⚠️ Unable to Load Submissions</h3>
              <p>Could not fetch data from the published sheet. Please check network connection.</p>
            </div>
          `;
        }
      });
    }

    function processRawData(data, headers) {
      if (!headers || headers.length === 0) return;

      const findCol = (keywords) => {
        return headers.find(h => {
          const cleanH = h.trim().toLowerCase();
          return keywords.some(k => cleanH.includes(k));
        }) || '';
      };

      const colTime = findCol(['time', 'date', 'timestamp']);
      const colGroup = findCol(['group']);
      const colName = findCol(['name']) !== findCol(['activity name']) ? findCol(['name']) : headers.find(h => h.trim().toLowerCase() === 'name');
      const colType = findCol(['activity type', 'type']);
      const colActName = findCol(['activity name', 'title']);
      const colDesc = findCol(['description', 'desc']);
      const colCode = findCol(['python', 'code']);
      const colPhoto = findCol(['photo', 'image', 'picture', 'working']);

      submissionsData = data.map((row, index) => {
        return {
          id: index,
          timestamp: row[colTime] || '',
          group: (row[colGroup] || 'Unassigned').trim(),
          name: (row[colName] || 'Anonymous').trim(),
          type: (row[colType] || 'In-class project').trim(),
          activityName: (row[colActName] || 'Untitled Activity').trim(),
          description: row[colDesc] || '',
          code: row[colCode] || '',
          photoIds: parseMultipleDriveIds(row[colPhoto] || '')
        };
      }).filter(item => item.name !== 'Anonymous' || item.code !== '');

      populateDropdowns();
      render();
    }

    // Extracts ALL Google Drive File IDs inside a cell string (handles up to 5 links)
    function parseMultipleDriveIds(rawCell) {
      if (!rawCell) return [];
      
      const idSet = new Set();
      const regex = /(?:id=|\/d\/|\/file\/d\/)([a-zA-Z0-9_-]{20,})/g;
      
      let match;
      while ((match = regex.exec(rawCell)) !== null) {
        if (match[1]) {
          idSet.add(match[1]);
        }
      }

      return Array.from(idSet);
    }

    /* ==========================================================================
       DROPDOWN MANAGERS
       ========================================================================== */
    function populateDropdowns() {
      // Groups
      const groups = [...new Set(submissionsData.map(s => s.group))]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      groupSelect.innerHTML = '<option value="ALL">All Groups</option>';
      groups.forEach(g => {
        groupSelect.innerHTML += `<option value="${escapeHtml(g)}">Group ${escapeHtml(g)}</option>`;
      });

      // Dynamic Activity Types
      const rawTypes = submissionsData.map(s => s.type).filter(Boolean);
      const uniqueTypes = [...new Set(rawTypes)].sort();

      typeSelect.innerHTML = '<option value="ALL">All Activity Types</option>';
      uniqueTypes.forEach(t => {
        typeSelect.innerHTML += `<option value="${escapeHtml(t)}"${state.type === t ? ' selected' : ''}>${escapeHtml(t)}</option>`;
      });

      updateNameDropdown();
    }

    function updateNameDropdown() {
      let filtered = submissionsData;
      if (state.group !== 'ALL') {
        filtered = filtered.filter(s => s.group === state.group);
      }

      const names = [...new Set(filtered.map(s => s.name))].sort();

      nameSelect.innerHTML = '<option value="ALL">All Students</option>';
      names.forEach(n => {
        nameSelect.innerHTML += `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`;
      });

      if (names.includes(state.name)) {
        nameSelect.value = state.name;
      } else {
        state.name = 'ALL';
        nameSelect.value = 'ALL';
      }
    }

    /* ==========================================================================
       RENDER CONTROLLER (ROUTER)
       ========================================================================== */
    function render() {
      let filtered = submissionsData;

      if (state.group !== 'ALL') filtered = filtered.filter(s => s.group === state.group);
      if (state.name !== 'ALL') filtered = filtered.filter(s => s.name === state.name);
      
      if (state.type !== 'ALL') {
        const targetType = state.type.toLowerCase().trim();
        filtered = filtered.filter(s => {
          const sType = (s.type || '').toLowerCase().trim();
          return sType === targetType || sType.includes(targetType) || targetType.includes(sType);
        });
      }

      if (state.search) {
        filtered = filtered.filter(s => 
          s.activityName.toLowerCase().includes(state.search) ||
          s.description.toLowerCase().includes(state.search) ||
          s.name.toLowerCase().includes(state.search)
        );
      }

      if (state.name !== 'ALL') {
        renderStudentPortfolio(state.name, filtered);
      } else if (state.group !== 'ALL') {
        renderGroupProfile(state.group, filtered);
      } else {
        renderOverview(filtered);
      }
    }

    /* ==========================================================================
       VIEW A: OVERVIEW
       ========================================================================== */
    function renderOverview(data) {
      const totalSubs = data.length;
      const activeStudents = new Set(data.map(s => s.name)).size;
      const totalGroups = new Set(data.map(s => s.group)).size;

      const recentFeed = [...data].reverse().slice(0, 10);

      stage.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${totalSubs}</div>
            <div class="stat-label">Total Submissions</div>
          </div>
          <div class="stat-card sun">
            <div class="stat-value">${activeStudents}</div>
            <div class="stat-label">Active Makers</div>
          </div>
          <div class="stat-card teal">
            <div class="stat-value">${totalGroups}</div>
            <div class="stat-label">Participating Groups</div>
          </div>
        </div>

        <div class="section-title-wrap">
          <h2 class="section-title">Recent Submissions Feed</h2>
          <span style="font-size: 13px; color: var(--san3a-wine);">Latest Activity</span>
        </div>

        ${recentFeed.length === 0 ? `
          <div class="empty-state">
            <h3>No Submissions Found</h3>
            <p>Try clearing your search query or activity type filter.</p>
          </div>
        ` : `
          <div class="feed-grid">
            ${recentFeed.map(sub => `
              <div class="feed-card" onclick="selectStudent('${escapeJs(sub.name)}', '${escapeJs(sub.group)}')">
                <div>
                  <div class="feed-student">${escapeHtml(sub.name)} <span class="chip chip-group">Group ${escapeHtml(sub.group)}</span></div>
                  <div class="feed-activity">${escapeHtml(sub.activityName)}</div>
                </div>
                <div style="text-align: right;">
                  ${getTypeChip(sub.type)}
                  <div class="feed-meta" style="margin-top: 6px;">${escapeHtml(sub.timestamp)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      `;
    }

    /* ==========================================================================
       VIEW B: STUDENT PROFILE PORTFOLIO
       ========================================================================== */
    function renderStudentPortfolio(studentName, data) {
      const studentSubs = data.filter(s => s.name === studentName);
      
      if (studentSubs.length === 0) {
        stage.innerHTML = `
          <div class="empty-state">
            <button class="btn-back-home" onclick="goHome()">🏠 Return to Overview</button>
            <h3 style="margin-top:12px;">No submissions found for ${escapeHtml(studentName)}</h3>
            <p>Try resetting the activity type or search filter.</p>
          </div>
        `;
        return;
      }

      const groupNum = studentSubs[0].group;
      const journeySubs = [...studentSubs].sort((a, b) => a.id - b.id);

      const homeCount = studentSubs.filter(s => s.type.toLowerCase().includes('home')).length;
      const inClassCount = studentSubs.filter(s => s.type.toLowerCase().includes('in-class')).length;
      const bonusCount = studentSubs.filter(s => s.type.toLowerCase().includes('bonus')).length;

      stage.innerHTML = `
        <div class="profile-banner">
          <button class="btn-back-home" onclick="goHome()">← Back to Home (Reset Filters)</button>
          <div class="profile-header" style="margin-top: 10px;">
            <div class="profile-title-area">
              <span class="chip chip-group">Group ${escapeHtml(groupNum)}</span>
              <h1>${escapeHtml(studentName)}</h1>
              <div class="type-breakdown">
                <span class="type-count-pill">🏠 ${homeCount} Home Challenges</span>
                <span class="type-count-pill">💻 ${inClassCount} In-Class Projects</span>
                <span class="type-count-pill">⭐ ${bonusCount} Bonus Projects</span>
              </div>
            </div>
            <div style="text-align: right;">
              <div class="stat-value" style="font-size: 32px;">${studentSubs.length}</div>
              <div class="stat-label">Total Projects</div>
            </div>
          </div>
        </div>

        <div class="section-title-wrap">
          <h2 class="section-title">Project Portfolio (Oldest → Newest)</h2>
        </div>

        <div class="portfolio-stack">
          ${journeySubs.map(sub => {
            const hasCode = Boolean(sub.code);
            const photoIds = sub.photoIds || [];
            const hasPhotos = photoIds.length > 0;
            const isBoth = hasCode && hasPhotos;

            return `
              <article class="submission-card">
                <div class="sub-card-header">
                  <div>
                    <h3 class="sub-card-title">${escapeHtml(sub.activityName)}</h3>
                    <div class="sub-card-date">Submitted: ${escapeHtml(sub.timestamp)}</div>
                  </div>
                  <div>
                    ${getTypeChip(sub.type)}
                  </div>
                </div>

                ${sub.description ? `
                  <div class="sub-description">${escapeHtml(sub.description)}</div>
                ` : ''}

                ${(hasCode || hasPhotos) ? `
                  <div class="sub-content-grid ${isBoth ? 'has-both' : ''}">
                    
                    ${hasCode ? `
                      <div class="code-block-wrap">
                        <div class="code-header">
                          <span>PYTHON CODE</span>
                          <button class="btn-copy" onclick="copyCode(this)">Copy Code</button>
                        </div>
                        <pre class="code-block"><code>${escapeHtml(sub.code)}</code></pre>
                      </div>
                    ` : ''}

                    ${hasPhotos ? `
                      <div class="side-photo-box">
                        <div class="side-photo-title">📷 Media &amp; Attachments (${photoIds.length})</div>
                        <div class="photo-gallery-side">
                          ${photoIds.map(id => `
                            <div class="photo-thumb-wrapper" id="wrap-${id}" data-id="${id}"></div>
                          `).join('')}
                        </div>
                      </div>
                    ` : ''}

                  </div>
                ` : ''}
              </article>
            `;
          }).join('')}
        </div>
      `;

      journeySubs.forEach(sub => (sub.photoIds || []).forEach(id => initMediaThumb(id)));
    }

    /* ==========================================================================
       VIEW C: GROUP PROFILE VIEW
       ========================================================================== */
    function renderGroupProfile(groupNum, data) {
      const groupSubs = data.filter(s => s.group === groupNum);
      const studentNames = [...new Set(groupSubs.map(s => s.name))].sort();

      stage.innerHTML = `
        <div class="profile-banner" style="border-left-color: var(--san3a-teal);">
          <button class="btn-back-home" onclick="goHome()">← Back to Home (Reset Filters)</button>
          <div class="profile-header" style="margin-top: 10px;">
            <div class="profile-title-area">
              <span class="chip chip-group">Group Profile</span>
              <h1>Group ${escapeHtml(groupNum)}</h1>
            </div>
            <div style="display: flex; gap: 24px; text-align: right;">
              <div>
                <div class="stat-value" style="font-size: 28px;">${studentNames.length}</div>
                <div class="stat-label">Makers</div>
              </div>
              <div>
                <div class="stat-value" style="font-size: 28px;">${groupSubs.length}</div>
                <div class="stat-label">Submissions</div>
              </div>
            </div>
          </div>
        </div>

        <div class="section-title-wrap">
          <h2 class="section-title">Group ${escapeHtml(groupNum)} Students</h2>
        </div>

        ${studentNames.length === 0 ? `
          <div class="empty-state">
            <h3>No Makers Found</h3>
            <p>No student submissions found for Group ${escapeHtml(groupNum)}.</p>
          </div>
        ` : `
          <div class="students-grid">
            ${studentNames.map(name => {
              const subs = groupSubs.filter(s => s.name === name);
              const latest = subs[subs.length - 1];
              return `
                <div class="student-card" onclick="selectStudent('${escapeJs(name)}', '${escapeJs(groupNum)}')">
                  <div class="student-card-name">${escapeHtml(name)}</div>
                  <div class="student-card-meta">${subs.length} total projects</div>
                  <div style="font-size: 13px; color: var(--san3a-maroon-d);">
                    <strong>Latest:</strong> ${escapeHtml(latest ? latest.activityName : 'N/A')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      `;
    }

    /* ==========================================================================
       MEDIA TYPE DETECTION & RENDER ENGINE
       ========================================================================== */
    // Only lh3.googleusercontent.com reliably refuses to serve video file IDs
    // as images, drive.google.com/thumbnail and uc?export=view both return a
    // usable-looking frame for videos too, so they can't be used to tell
    // photos and videos apart. But lh3 alone can also fail transiently on a
    // genuine photo (rate limiting, size, caching), so detection retries lh3
    // itself a couple of times before concluding "not a photo". Once a file
    // is confirmed a photo, the other two endpoints remain in play purely as
    // display fallbacks if the working URL later stops loading.
    function initMediaThumb(id) {
      const wrapper = document.getElementById(`wrap-${id}`);
      if (!wrapper) return;

      probeLh3(id, 0, (isPhoto) => {
        isPhoto ? renderImageThumb(wrapper, id) : renderVideoThumb(wrapper, id);
      });
    }

    function probeLh3(id, attempt, callback) {
      const probe = new Image();
      let settled = false;

      const finish = (ok) => {
        if (settled) return;
        settled = true;
        if (ok || attempt >= 2) {
          callback(ok);
        } else {
          probeLh3(id, attempt + 1, callback);
        }
      };

      probe.onload = () => finish(true);
      probe.onerror = () => finish(false);
      setTimeout(() => finish(false), 5000);

      probe.src = `https://lh3.googleusercontent.com/d/${id}=w1000`;
    }

    function renderImageThumb(wrapper, id) {
      wrapper.innerHTML = `
        <img class="photo-thumb-side"
             src="https://lh3.googleusercontent.com/d/${id}=w1000"
             alt="Project media preview"
             data-id="${id}"
             data-try="1"
             onclick="openLightbox(this.src, '${id}', false)"
             onerror="handleImgError(this, '${id}')">
      `;
    }

    function renderVideoThumb(wrapper, id) {
      wrapper.classList.add('video-thumb-wrapper');
      wrapper.setAttribute('onclick', `openLightbox('', '${id}', true)`);
      wrapper.innerHTML = `
        <img class="photo-thumb-side" src="https://drive.google.com/thumbnail?id=${id}&sz=w1000" alt="Video preview" onerror="this.style.display='none';">
        <div class="video-badge"><span class="video-badge-icon">▶</span></div>
      `;
    }

    function handleImgError(img, id) {
      const tryStage = parseInt(img.getAttribute('data-try') || '1', 10);

      if (tryStage === 1) {
        // Fallback Stage 1: Google Drive Thumbnail API
        img.setAttribute('data-try', '2');
        img.src = `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
      } else if (tryStage === 2) {
        // Fallback Stage 2: Direct UC Export View
        img.setAttribute('data-try', '3');
        img.src = `https://drive.google.com/uc?export=view&id=${id}`;
      } else {
        // Fallback Stage 3: still not loadable as an image, show a clean link
        const wrapper = img.parentElement;
        if (wrapper) {
          wrapper.innerHTML = `
            <a href="https://drive.google.com/open?id=${id}" target="_blank" class="media-file-link" title="Open file in Google Drive">
              <span>📎</span> View File
            </a>
          `;
        }
      }
    }

    /* ==========================================================================
       UTILITIES & HELPERS
       ========================================================================== */
    function getTypeChip(type) {
      const cleanType = (type || '').toLowerCase();
      if (cleanType.includes('home')) return `<span class="chip chip-home">Home Challenge</span>`;
      if (cleanType.includes('bonus')) return `<span class="chip chip-bonus">Bonus</span>`;
      if (cleanType.includes('in-class') || cleanType.includes('in class')) return `<span class="chip chip-inclass">In-Class Project</span>`;
      return `<span class="chip chip-other">${escapeHtml(type || 'Other')}</span>`;
    }

    function selectStudent(name, group) {
      state.group = group;
      state.name = name;
      groupSelect.value = group;
      updateNameDropdown();
      nameSelect.value = name;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function copyCode(btn) {
      const codeBlock = btn.parentElement.nextElementSibling.querySelector('code');
      if (!codeBlock) return;

      navigator.clipboard.writeText(codeBlock.innerText).then(() => {
        const orig = btn.innerText;
        btn.innerText = "✓ Copied!";
        setTimeout(() => btn.innerText = orig, 2000);
      });
    }

    function openLightbox(url, id, isVideo) {
      if (isVideo && id) {
        lightboxImg.style.display = 'none';
        lightboxImg.src = '';
        lightboxVideo.src = `https://drive.google.com/file/d/${id}/preview`;
        lightboxVideo.style.display = 'block';
      } else {
        lightboxVideo.style.display = 'none';
        lightboxVideo.src = '';
        lightboxImg.style.display = 'block';
        lightboxImg.src = url;
      }

      lightbox.classList.add('active');
    }

    function closeLightbox() {
      lightbox.classList.remove('active');
      lightboxVideo.src = '';
      lightboxVideo.style.display = 'none';
      lightboxImg.style.display = 'block';
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function escapeJs(str) {
      if (!str) return '';
      return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
    }