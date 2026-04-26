#!/usr/bin/env python3
import re

with open('public/index.html', 'r') as f:
    content = f.read()

# Add CSS styles for direct download
css_styles = """
        .header-controls {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .url-input-wrapper {
            display: flex;
            gap: 10px;
        }

        .url-input {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid var(--border);
            padding: 10px 15px;
            border-radius: var(--radius);
            color: var(--text);
            font-size: 13px;
            outline: none;
            transition: all 0.3s ease;
            width: 300px;
        }

        .url-input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 15px var(--primary-glow);
            background: rgba(0, 0, 0, 0.6);
        }

        .url-input::placeholder {
            color: var(--text-muted);
        }

        .direct-download-btn {
            background: transparent;
            border: 1px solid var(--primary);
            padding: 10px 20px;
            border-radius: var(--radius);
            color: var(--primary);
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.3s;
            white-space: nowrap;
        }

        .direct-download-btn:hover {
            background: var(--primary);
            color: var(--text);
            box-shadow: var(--shadow-glow);
        }
"""

# Insert CSS after .search-form definition
content = content.replace(
    '.search-form {\n            flex: 1;',
    '.header-controls {\n            display: flex;\n            align-items: center;\n            gap: 15px;\n        }\n\n        .search-form {\n            flex: 1;'
)

# Add CSS for new elements after .search-input block
search_pattern = '        .search-input {\n            width: 100%;'
replacement = f'        .search-input {{\n            width: 100%;{css_styles}'
content = content.replace(search_pattern, replacement, 1)

# Fix the search-input closing
content = content.replace(
    '.search-input {\n            width: 100%;\n        }',
    '.search-input {\n            width: 100%;\n            background: rgba(0, 0, 0, 0.4);\n            border: 1px solid var(--border);'
)

# Add HTML for direct download
html_controls = '''                <div class="header-controls">
                    <div class="url-input-wrapper">
                        <input type="text" class="url-input" id="directUrlInput" placeholder="Ссылка на видео...">
                        <button type="button" class="direct-download-btn" onclick="startDirectDownload()">⬇️ СКАЧАТЬ</button>
                    </div>
                </div>'''

content = content.replace(
    '                </form>\n            </div>',
    '                </form>\n' + html_controls + '\n            </div>'
)

# Add JS function
js_function = '''        // ===== Direct Download =====
        function startDirectDownload() {
            const urlInput = document.getElementById('directUrlInput');
            const url = urlInput?.value?.trim();
            if (!url) {
                showNotification('Вставьте ссылку', true);
                return;
            }
            try {
                new URL(url);
            } catch {
                showNotification('Неверная ссылка', true);
                return;
            }
            if (urlInput) urlInput.value = '';
            startDownload(url);
        }

'''

content = content.replace(
    '        // ===== API Functions =====',
    js_function + '        // ===== API Functions ====='
)

# Update responsive CSS
old_responsive = '''        /* Responsive */
        @media (max-width: 768px) {
            .header-content {
                flex-direction: column;
                gap: 15px;
            }
            .search-form {
                max-width: 100%;
            }
            .video-grid {
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 15px;
            }
            .downloads-container {
                bottom: 20px;
                right: 20px;
                left: 20px;
                width: auto;
                max-width: calc(100vw - 40px);
            }
            .dl-panel {
                width: 100%;
            }
        }'''

new_responsive = '''        /* Responsive */
        @media (max-width: 1024px) {
            .header-content {
                flex-wrap: wrap;
                gap: 15px;
            }
            .search-form {
                flex: none;
                max-width: 500px;
                order: 2;
            }
            .header-controls {
                order: 3;
                width: 100%;
                justify-content: center;
            }
            .url-input-wrapper {
                max-width: 600px;
                width: 100%;
            }
            .url-input {
                width: 100%;
            }
        }
        @media (max-width: 768px) {
            .header-content {
                flex-direction: column;
                align-items: stretch;
            }
            .search-form {
                max-width: 100%;
                order: 1;
            }
            .header-controls {
                order: 2;
            }
            .url-input-wrapper {
                flex-direction: column;
            }
            .video-grid {
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 15px;
            }
            .downloads-container {
                bottom: 20px;
                right: 20px;
                left: 20px;
                width: auto;
                max-width: calc(100vw - 40px);
            }
            .dl-panel {
                width: 100%;
            }
        }'''

content = content.replace(old_responsive, new_responsive)

with open('public/index.html', 'w') as f:
    f.write(content)

print("Done")
