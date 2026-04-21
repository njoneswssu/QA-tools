// Wait for DOM to be fully loaded before accessing elements
document.addEventListener('DOMContentLoaded', function() {
    initializeConverter();
});

// Also run immediately if DOM is already loaded (for extension context)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeConverter);
} else {
    initializeConverter();
}

function initializeConverter() {
    console.log('Initializing XML Converter...');
    const inputArea = document.getElementById('inputArea');
    const outputArea = document.getElementById('outputArea');
    const inputTitle = document.getElementById('inputTitle');
    const orderModeBtn = document.getElementById('orderModeBtn');
    const xmlModeBtn = document.getElementById('xmlModeBtn');
    const wscoModeBtn = document.getElementById('wscoModeBtn');
    const convertBtn = document.getElementById('convertBtn');
    const reverseConvertBtn = document.getElementById('reverseConvertBtn');
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const statusMessage = document.getElementById('statusMessage');
    const converterSection = document.getElementById('converterSection');
    const wscoSection = document.getElementById('wscoSection');
    const buttonContainer = document.getElementById('buttonContainer');
    const xmlTreeContainer = document.getElementById('xmlTreeContainer');
    const xmlTreeOverlay = document.getElementById('xmlTreeOverlay');
    const closeXmlTreeBtn = document.getElementById('closeXmlTreeBtn');
    const editXmlBtn = document.getElementById('editXmlBtn');
    const xmlEditContainer = document.getElementById('xmlEditContainer');
    const xmlEditArea = document.getElementById('xmlEditArea');
    const saveXmlBtn = document.getElementById('saveXmlBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const wscoIframe = document.getElementById('wscoIframe');
    const wscoBackBtn = document.getElementById('wscoBackBtn');
    const wscoForwardBtn = document.getElementById('wscoForwardBtn');
    const wscoRefreshBtn = document.getElementById('wscoRefreshBtn');
    const chromeReloadBtn = document.getElementById('chromeReloadBtn');
    const chromeAddressInput = document.getElementById('chromeAddressInput');
    const chromeTabTitle = document.getElementById('chromeTabTitle');
    
    // Check if all required elements exist
    if (!inputArea || !outputArea || !orderModeBtn || !xmlModeBtn || !wscoModeBtn) {
        console.error('Required DOM elements not found');
        return;
    }
    
    let currentWSCOXmlRaw = ''; // Store raw XML for editing
    let currentMode = 'xml'; // 'order', 'xml', or 'wsco' - default to XML mode

function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${isError ? 'status-error' : 'status-success'}`;
    statusMessage.style.display = 'block';
    
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 3000);
}

function generateCurrentDate() {
    const now = new Date();
    
    // Generate a random number of days between 1 and 10 days ago
    const randomDaysAgo = Math.floor(Math.random() * 10) + 1;
    
    // Generate a date that's randomDaysAgo days ago from today
    const shipmentDate = new Date(now);
    shipmentDate.setDate(now.getDate() - randomDaysAgo);
    
    const year = shipmentDate.getFullYear();
    const month = String(shipmentDate.getMonth() + 1).padStart(2, '0');
    const day = String(shipmentDate.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day} 0:0:0.0`;
}

function extractOrderNumberFromBlock(block) {
    const m = String(block).match(/<OrderNumber>([^<]*)<\/OrderNumber>/i);
    return m ? m[1].trim() : '';
}

function stripAllComergentDataTags(text) {
    return String(text)
        .replace(/<ComergentData\b[^>]*>/gi, '')
        .replace(/<\/ComergentData>/gi, '');
}

/** Remove every ComergentData wrapper and XML declarations so only <Comergent> fragments remain. */
function stripOuterXmlDeclarationAndComergentData(text) {
    let t = String(text).trim();
    t = t.replace(/<\?xml[\s\S]*?\?>\s*/gi, '');
    t = stripAllComergentDataTags(t);
    return t.trim();
}

function splitComergentBlocks(inputText) {
    const inner = stripOuterXmlDeclarationAndComergentData(inputText);
    return inner.split(/(?=<Comergent>)/g).filter((b) => b.trim());
}

function dedupeComergentBlocksByOrderNumber(blocks) {
    const seen = new Set();
    const out = [];
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i].trim();
        if (!block) continue;
        const orderNum = extractOrderNumberFromBlock(block);
        const key = orderNum ? orderNum : `__no_order_${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(block);
    }
    return out;
}

function wrapSingleComergentData(innerXml) {
    const body = stripAllComergentDataTags(String(innerXml)).trim();
    if (!body) return '';
    return `<ComergentData>\n${body}\n</ComergentData>`;
}

function dedupeOrderNumberLines(inputText) {
    const seen = new Set();
    const out = [];
    inputText.split('\n').forEach((line) => {
        const t = line.trim();
        if (!t || seen.has(t)) return;
        seen.add(t);
        out.push(t);
    });
    return out;
}

function generateXMLTemplate(orderNumber, isShipment = false) {
    const orderInput = isShipment ? 'ORDER INPUT SHIPMENT' : 'ORDER INPUT ORDER STATUS UPDATE ACCEPT';
    const shipmentDateTag = isShipment ? `\n                    <ShipmentDate>${generateCurrentDate()}</ShipmentDate>` : '';
    const trackingInfo = isShipment ? `
    <JCPOrderShipmentUpdateInfoList state="INSERTED">
        <JCPOrderShipmentUpdateInfo state="INSERTED">
            <TrackingNumber>1Z3A06R10318464892</TrackingNumber>
            <ShipCarrier>UPS Ground</ShipCarrier>
            <CarrierSCAC>UPS</CarrierSCAC>
        </JCPOrderShipmentUpdateInfo>
    </JCPOrderShipmentUpdateInfoList>` : '';

    return `
    <Comergent>
<MessageHeader>
    <MessageType>OrderStatusUpdateRequest</MessageType>
    <MessageVersion>4.0</MessageVersion>
</MessageHeader>
<RemoteUser>
    <UserLogin>ERPAdmin</UserLogin>
    <UserAuthenticator>ERPAdmin</UserAuthenticator>
</RemoteUser>
<OrderStatusUpdate type="BusinessObject" state="INSERTED">
    <OrderNumber>${orderNumber}</OrderNumber>
    <JCPSupplierNumber>153411</JCPSupplierNumber>
    <ERPOrderNumber>0</ERPOrderNumber>
    <OrderInput>${orderInput}</OrderInput>
    <OrderShipmentUpdateLineItemList state="INSERTED">
        <OrderShipmentUpdateLineItem state="INSERTED">
            <JCPSubNumber>739</JCPSubNumber>
            <JCPLotNumber>9862</JCPLotNumber>
            <JCPLineNumber>0105</JCPLineNumber>
            <SKU />
            <Quantity>1</Quantity>
            <JCPRejectionText />
            <LineStatus>ACCEPT</LineStatus>${shipmentDateTag}
        </OrderShipmentUpdateLineItem>
    </OrderShipmentUpdateLineItemList>${trackingInfo}
</OrderStatusUpdate>
    </Comergent>`;
}

function switchMode(mode) {
    currentMode = mode;
    
    // Reset all buttons
    orderModeBtn.classList.remove('active');
    xmlModeBtn.classList.remove('active');
    wscoModeBtn.classList.remove('active');
    
    if (mode === 'order') {
        stopIframeMonitoring();
        stopNavMonitoring();
        closeXMLTree();
        orderModeBtn.classList.add('active');
        inputTitle.textContent = 'Input Order Numbers';
        inputArea.placeholder = 'Paste order numbers here (one per line)...\nExample:\n02438130\n02438109\n02440750';
        converterSection.style.display = 'grid';
        wscoSection.style.display = 'none';
        buttonContainer.style.display = 'flex';
    } else if (mode === 'wsco') {
        wscoModeBtn.classList.add('active');
        converterSection.style.display = 'none';
        wscoSection.style.display = 'block';
        buttonContainer.style.display = 'none';
        startNavMonitoring();
    } else {
        stopIframeMonitoring();
        stopNavMonitoring();
        closeXMLTree();
        xmlModeBtn.classList.add('active');
        inputTitle.textContent = 'Input XML';
        inputArea.placeholder = 'Paste your XML code here...';
        converterSection.style.display = 'grid';
        wscoSection.style.display = 'none';
        buttonContainer.style.display = 'flex';
    }
    
    inputArea.value = '';
    outputArea.value = '';
    copyBtn.disabled = true;
    downloadBtn.disabled = true;
}

function convertXML() {
    const inputText = inputArea.value.trim();
    
    if (!inputText) {
        const inputType = currentMode === 'order' ? 'order numbers' : 'XML content';
        showStatus(`Please paste some ${inputType} to convert.`, true);
        return;
    }

    try {
        let finalOutput = '';

        if (currentMode === 'order') {
            // Order number mode - generate XML from order numbers (unique only, first occurrence wins)
            const orderNumbers = dedupeOrderNumberLines(inputText);

            orderNumbers.forEach((orderNumber, index) => {
                if (!orderNumber) return;

                // Generate ORDER STATUS UPDATE ACCEPT version (converted)
                const convertedXML = generateXMLTemplate(orderNumber, false);
                
                // Generate ORDER INPUT SHIPMENT version (original)
                const originalXML = generateXMLTemplate(orderNumber, true);

                // Add converted followed by original
                finalOutput += convertedXML + originalXML;
            });

            const orderCount = orderNumbers.length;
            showStatus(`Successfully converted ${orderCount} unique order number${orderCount > 1 ? 's' : ''}!`);
        } else {
            // XML mode - one accept + one shipment pair per unique OrderNumber
            const comergentBlocks = dedupeComergentBlocksByOrderNumber(splitComergentBlocks(inputText));

            comergentBlocks.forEach((block, index) => {
                if (!block.trim()) return;

                // Process each block individually
                let convertedBlock = block;

                // Always convert TO ORDER STATUS UPDATE ACCEPT (blue button)
                convertedBlock = convertedBlock.replace(
                    /ORDER INPUT SHIPMENT/g, 
                    'ORDER INPUT ORDER STATUS UPDATE ACCEPT'
                );
                convertedBlock = convertedBlock.replace(
                    /ORDER INPUT ORDER STATUS UPDATE ACCEPT/g, 
                    'ORDER INPUT ORDER STATUS UPDATE ACCEPT'
                );

                // Remove all <ShipmentDate> tags and their content for ORDER STATUS UPDATE ACCEPT
                convertedBlock = convertedBlock.replace(
                    /<ShipmentDate>.*?<\/ShipmentDate>/g, 
                    ''
                );

                // Remove entire <JCPOrderShipmentUpdateInfoList> sections
                convertedBlock = convertedBlock.replace(
                    /<JCPOrderShipmentUpdateInfoList[^>]*>[\s\S]*?<\/JCPOrderShipmentUpdateInfoList>/g, 
                    ''
                );

                // Create the ORDER INPUT SHIPMENT version for second block
                let shipmentBlock = block;
                
                // Clean existing shipment dates to prevent duplicates
                shipmentBlock = shipmentBlock.replace(
                    /<ShipmentDate>.*?<\/ShipmentDate>/g, 
                    ''
                );
                
                shipmentBlock = shipmentBlock.replace(
                    /ORDER INPUT SHIPMENT/g, 
                    'ORDER INPUT SHIPMENT'
                );
                shipmentBlock = shipmentBlock.replace(
                    /ORDER INPUT ORDER STATUS UPDATE ACCEPT/g, 
                    'ORDER INPUT SHIPMENT'
                );

                // Now add fresh <ShipmentDate> after every <LineStatus> (no duplicates)
                shipmentBlock = shipmentBlock.replace(
                    /(<LineStatus>ACCEPT<\/LineStatus>)/g,
                    `$1\n                    <ShipmentDate>${generateCurrentDate()}</ShipmentDate>`
                );

                // Add JCPOrderShipmentUpdateInfoList to shipment block if not present
                if (!shipmentBlock.includes('<JCPOrderShipmentUpdateInfoList>')) {
                    shipmentBlock = shipmentBlock.replace(
                        /(<\/OrderShipmentUpdateLineItemList>)/g,
                        `$1
    <JCPOrderShipmentUpdateInfoList state="INSERTED">
        <JCPOrderShipmentUpdateInfo state="INSERTED">
            <TrackingNumber>1Z3A06R10318464892</TrackingNumber>
            <ShipCarrier>UPS Ground</ShipCarrier>
            <CarrierSCAC>UPS</CarrierSCAC>
        </JCPOrderShipmentUpdateInfo>
    </JCPOrderShipmentUpdateInfoList>`
                    );
                }

                // Clean up extra whitespace and empty lines for both blocks
                convertedBlock = convertedBlock.replace(/\n\s*\n\s*\n/g, '\n\n');
                convertedBlock = convertedBlock.replace(/^\s*\n/gm, '');
                shipmentBlock = shipmentBlock.replace(/\n\s*\n\s*\n/g, '\n\n');
                shipmentBlock = shipmentBlock.replace(/^\s*\n/gm, '');

                // Add ORDER STATUS UPDATE ACCEPT first, then ORDER INPUT SHIPMENT second
                finalOutput += convertedBlock + shipmentBlock;
            });

            const blockCount = comergentBlocks.length;
            showStatus(`Successfully converted ${blockCount} unique order${blockCount > 1 ? 's' : ''} (accept + shipment each)!`);
        }

        outputArea.value = wrapSingleComergentData(finalOutput);
        copyBtn.disabled = false;
        downloadBtn.disabled = false;
    } catch (error) {
        showStatus('Error converting: ' + error.message, true);
    }
}

function copyToClipboard() {
    if (!outputArea.value) {
        showStatus('No converted XML to copy.', true);
        return;
    }

    outputArea.select();
    outputArea.setSelectionRange(0, 99999); // For mobile devices

    try {
        document.execCommand('copy');
        showStatus('Successfully copied to clipboard!');
    } catch (error) {
        // Fallback for modern browsers
        navigator.clipboard.writeText(outputArea.value).then(() => {
            showStatus('Successfully copied to clipboard!');
        }).catch(() => {
            showStatus('Failed to copy to clipboard.', true);
        });
    }
}

function downloadXML() {
    if (!outputArea.value) {
        showStatus('No converted XML to download.', true);
        return;
    }

    // Generate timestamp for filename
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    
    let wrappedXML = outputArea.value.trim();
    if (!/^<ComergentData\b/i.test(wrappedXML)) {
        wrappedXML = wrapSingleComergentData(wrappedXML);
    }

    const blob = new Blob([wrappedXML], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `converted_order_status_${timestamp}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus('Successfully downloaded XML file!');
}

function reverseConvertXML() {
    const inputText = inputArea.value.trim();
    
    if (!inputText) {
        const inputType = currentMode === 'order' ? 'order numbers' : 'XML content';
        showStatus(`Please paste some ${inputType} to convert.`, true);
        return;
    }

    try {
        let finalOutput = '';

        if (currentMode === 'order') {
            // Order number mode - generate XML from order numbers (unique only)
            const orderNumbers = dedupeOrderNumberLines(inputText);

            orderNumbers.forEach((orderNumber, index) => {
                if (!orderNumber) return;

                // Generate ORDER INPUT SHIPMENT version (converted)
                const convertedXML = generateXMLTemplate(orderNumber, true);
                
                // Generate ORDER STATUS UPDATE ACCEPT version (original)
                const originalXML = generateXMLTemplate(orderNumber, false);

                // Add converted followed by original
                finalOutput += convertedXML + originalXML;
            });

            const orderCount = orderNumbers.length;
            showStatus(`Successfully converted ${orderCount} unique order number${orderCount > 1 ? 's' : ''} to ORDER INPUT SHIPMENT!`);
        } else {
            // XML mode - one shipment block per unique OrderNumber
            const comergentBlocks = dedupeComergentBlocksByOrderNumber(splitComergentBlocks(inputText));

            comergentBlocks.forEach((block, index) => {
                if (!block.trim()) return;

                // Process each block individually - convert TO ORDER INPUT SHIPMENT
                let convertedBlock = block;

                // Always convert TO ORDER INPUT SHIPMENT (red button)
                convertedBlock = convertedBlock.replace(
                    /ORDER INPUT SHIPMENT/g, 
                    'ORDER INPUT SHIPMENT'
                );
                convertedBlock = convertedBlock.replace(
                    /ORDER INPUT ORDER STATUS UPDATE ACCEPT/g, 
                    'ORDER INPUT SHIPMENT'
                );

                // Clean existing shipment dates to prevent duplicates
                convertedBlock = convertedBlock.replace(
                    /<ShipmentDate>.*?<\/ShipmentDate>/g, 
                    ''
                );

                // Add <ShipmentDate> after every <LineStatus>
                convertedBlock = convertedBlock.replace(
                    /(<LineStatus>ACCEPT<\/LineStatus>)/g,
                    `$1\n                    <ShipmentDate>${generateCurrentDate()}</ShipmentDate>`
                );

                // Add JCPOrderShipmentUpdateInfoList if not present
                if (!convertedBlock.includes('<JCPOrderShipmentUpdateInfoList>')) {
                    convertedBlock = convertedBlock.replace(
                        /(<\/OrderShipmentUpdateLineItemList>)/g,
                        `$1
    <JCPOrderShipmentUpdateInfoList state="INSERTED">
        <JCPOrderShipmentUpdateInfo state="INSERTED">
            <TrackingNumber>1Z3A06R10318464892</TrackingNumber>
            <ShipCarrier>UPS Ground</ShipCarrier>
            <CarrierSCAC>UPS</CarrierSCAC>
        </JCPOrderShipmentUpdateInfo>
    </JCPOrderShipmentUpdateInfoList>`
                    );
                }

                // Clean up extra whitespace and empty lines
                convertedBlock = convertedBlock.replace(/\n\s*\n\s*\n/g, '\n\n');
                convertedBlock = convertedBlock.replace(/^\s*\n/gm, '');

                // Add ONLY the ORDER INPUT SHIPMENT version
                finalOutput += convertedBlock;
            });

            const blockCount = comergentBlocks.length;
            showStatus(`Successfully converted ${blockCount} unique order${blockCount > 1 ? 's' : ''} to ORDER INPUT SHIPMENT!`);
        }

        outputArea.value = wrapSingleComergentData(finalOutput);
        copyBtn.disabled = false;
        downloadBtn.disabled = false;
    } catch (error) {
        showStatus('Error converting: ' + error.message, true);
    }
}

// XML Tree Viewer Functions
function parseXMLToTree(xmlString) {
    try {
        // Clean up the XML string - remove any HTML wrapper
        let cleanXML = xmlString.trim();
        
        // Decode HTML entities first
        if (cleanXML.includes('&lt;') || cleanXML.includes('&gt;') || cleanXML.includes('&amp;')) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cleanXML;
            cleanXML = tempDiv.textContent || tempDiv.innerText || cleanXML;
        }
        
        // Remove HTML tags that might wrap the XML
        cleanXML = cleanXML.replace(/<html[^>]*>[\s\S]*?<body[^>]*>/i, '');
        cleanXML = cleanXML.replace(/<\/body>[\s\S]*?<\/html>/i, '');
        cleanXML = cleanXML.replace(/<pre[^>]*>/gi, '');
        cleanXML = cleanXML.replace(/<\/pre>/gi, '');
        cleanXML = cleanXML.replace(/<code[^>]*>/gi, '');
        cleanXML = cleanXML.replace(/<\/code>/gi, '');
        
        // Extract XML portion - prioritize XML declaration, then ComergentData, then Comergent
        let xmlStart = -1;
        let xmlEnd = -1;
        
        // Method 1: Look for XML declaration first (most reliable)
        const xmlDeclMatch = cleanXML.match(/<\?xml[\s\S]*?\?>/i);
        if (xmlDeclMatch) {
            xmlStart = cleanXML.indexOf(xmlDeclMatch[0]);
            // After XML declaration, find the root element
            const afterDecl = cleanXML.substring(xmlStart + xmlDeclMatch[0].length);
            const rootMatch = afterDecl.match(/<(\w+)[\s>]/);
            if (rootMatch) {
                const rootTag = rootMatch[1];
                // Find the closing tag for the root element
                const closingTagPattern = new RegExp(`</${rootTag}>`, 'i');
                const closingMatch = cleanXML.match(closingTagPattern);
                if (closingMatch) {
                    xmlEnd = cleanXML.lastIndexOf(closingMatch[0]) + closingMatch[0].length;
                }
            }
        }
        
        // Method 2: If no XML declaration, look for ComergentData wrapper
        if (xmlStart === -1) {
            const comergentDataMatch = cleanXML.match(/<ComergentData[\s>]/i);
            if (comergentDataMatch) {
                xmlStart = cleanXML.indexOf(comergentDataMatch[0]);
                const closingMatch = cleanXML.match(/<\/ComergentData>/i);
                if (closingMatch) {
                    xmlEnd = cleanXML.lastIndexOf(closingMatch[0]) + closingMatch[0].length;
                }
            }
        }
        
        // Method 3: If still not found, look for Comergent tag
        if (xmlStart === -1) {
            const comergentMatch = cleanXML.match(/<Comergent[\s>]/i);
            if (comergentMatch) {
                xmlStart = cleanXML.indexOf(comergentMatch[0]);
                const closingMatch = cleanXML.match(/<\/Comergent>/i);
                if (closingMatch) {
                    xmlEnd = cleanXML.lastIndexOf(closingMatch[0]) + closingMatch[0].length;
                }
            }
        }
        
        // Method 4: Fallback - find first < and last >
        if (xmlStart === -1) {
            xmlStart = cleanXML.indexOf('<');
            if (xmlStart >= 0) {
                xmlEnd = cleanXML.lastIndexOf('>') + 1;
            }
        }
        
        // Extract the XML portion
        if (xmlStart >= 0 && xmlEnd > xmlStart) {
            cleanXML = cleanXML.substring(xmlStart, xmlEnd);
        } else if (xmlStart >= 0) {
            cleanXML = cleanXML.substring(xmlStart);
        }
        
        // Final cleanup - remove any remaining non-XML content
        cleanXML = cleanXML.trim();
        
        // Remove any script or style tags
        cleanXML = cleanXML.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        cleanXML = cleanXML.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        
        // Ensure we have valid XML structure
        if (!cleanXML || !cleanXML.startsWith('<')) {
            throw new Error('No valid XML found in the content');
        }
        
        // Ensure proper XML structure - if we have multiple Comergent but no ComergentData wrapper
        if (cleanXML.includes('<Comergent>') && !cleanXML.includes('<ComergentData>')) {
            const comergentCount = (cleanXML.match(/<Comergent>/g) || []).length;
            if (comergentCount > 1) {
                // Wrap multiple Comergent elements in ComergentData
                cleanXML = '<?xml version="1.0" encoding="UTF-8"?>\n<ComergentData>\n' + cleanXML.replace(/<\?xml[\s\S]*?\?>\s*/i, '') + '\n</ComergentData>';
            }
        }
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(cleanXML, 'text/xml');
        
        // Check for parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            const errorText = parserError.textContent || 'Unknown parsing error';
            throw new Error('Invalid XML: ' + errorText);
        }
        
        // Return the root element (ComergentData if present, otherwise Comergent)
        return xmlDoc.documentElement;
    } catch (error) {
        throw new Error('Failed to parse XML: ' + error.message);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderXMLNode(node, level = 0, nodeIdPrefix = '') {
    if (!node) return '';
    
    let html = '';
    const nodeId = nodeIdPrefix + '-' + level + '-' + Math.random().toString(36).substr(2, 5);
    
    if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName;
        
        // Get all child nodes
        const childNodes = Array.from(node.childNodes);
        const childElements = childNodes.filter(n => n.nodeType === Node.ELEMENT_NODE);
        const textNodes = childNodes.filter(n => n.nodeType === Node.TEXT_NODE);
        
        // Get text content
        const textContent = textNodes.map(n => n.textContent).join('');
        const hasChildren = childElements.length > 0;
        const hasText = textContent.trim().length > 0;
        const isEmpty = !hasChildren && !hasText;
        
        // Build attributes string - Chrome style
        let attrs = '';
        if (node.attributes && node.attributes.length > 0) {
            attrs = ' ' + Array.from(node.attributes)
                .map(attr => `<span class="xml-attribute-name">${escapeHtml(attr.name)}</span>="<span class="xml-attribute-value">${escapeHtml(attr.value)}</span>"`)
                .join(' ');
        }
        
        const indent = level * 16;
        html += `<div class="xml-element" style="padding-left: ${indent}px;">`;
        
        if (isEmpty) {
            // Self-closing or empty element
            html += `<span class="xml-tag">&lt;${tagName}${attrs} /&gt;</span>`;
        } else {
            // Element with content
            html += `<span class="xml-toggle expanded" onclick="toggleXMLNode('${nodeId}')"></span>`;
            html += `<span class="xml-tag">&lt;${tagName}${attrs}&gt;</span>`;
            
            // Show text content if it's the only content
            if (hasText && !hasChildren) {
                html += `<span class="xml-value">${escapeHtml(textContent.trim())}</span>`;
            }
            
            html += `<div class="xml-children" id="${nodeId}">`;
            
            // Process child nodes in order
            childNodes.forEach((child, idx) => {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    html += renderXMLNode(child, level + 1, nodeId + '-' + idx);
                } else if (child.nodeType === Node.TEXT_NODE) {
                    const text = child.textContent;
                    if (text.trim()) {
                        html += `<div class="xml-text-node" style="padding-left: ${(level + 1) * 16}px;"><span class="xml-value">${escapeHtml(text.trim())}</span></div>`;
                    }
                }
            });
            
            html += `</div>`;
            html += `<span class="xml-tag">&lt;/${tagName}&gt;</span>`;
        }
        
        html += `</div>`;
    }
    
    return html;
}

function displayXMLTree(xmlString) {
    try {
        // Store raw XML for editing
        currentWSCOXmlRaw = xmlString;
        
        // Debug: log what we're trying to parse
        console.log('Attempting to parse XML:', xmlString.substring(0, 200));
        
        const rootNode = parseXMLToTree(xmlString);
        const treeHtml = renderXMLNode(rootNode);
        
        if (!treeHtml || treeHtml.trim() === '') {
            throw new Error('Empty tree generated from XML');
        }
        
        xmlTreeContainer.innerHTML = `<div class="xml-tree">${treeHtml}</div>`;
        // Show the overlay
        if (xmlTreeOverlay) {
            xmlTreeOverlay.style.display = 'flex';
        }
    } catch (error) {
        console.error('Error displaying XML tree:', error);
        // Show raw XML
        xmlTreeContainer.innerHTML = `<div class="xml-placeholder"><p style="color: #dc3545;">Error: ${escapeHtml(error.message)}</p><pre style="text-align: left; white-space: pre-wrap; word-wrap: break-word; color: #333; max-height: 400px; overflow-y: auto;">${escapeHtml(xmlString)}</pre></div>`;
        // Still show overlay even on error
        if (xmlTreeOverlay) {
            xmlTreeOverlay.style.display = 'flex';
        }
        // Store the raw XML even if parsing failed
        currentWSCOXmlRaw = xmlString;
    }
}


function showEditMode() {
    if (xmlTreeContainer) xmlTreeContainer.style.display = 'none';
    if (xmlEditContainer) {
        xmlEditContainer.style.display = 'flex';
        if (xmlEditArea && currentWSCOXmlRaw) {
            // Format XML with proper indentation
            xmlEditArea.value = formatXML(currentWSCOXmlRaw);
        }
    }
}

function hideEditMode() {
    if (xmlTreeContainer) xmlTreeContainer.style.display = 'block';
    if (xmlEditContainer) xmlEditContainer.style.display = 'none';
}

function formatXML(xml) {
    // Better XML formatter
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, 'text/xml');
        const serializer = new XMLSerializer();
        let formatted = serializer.serializeToString(xmlDoc);
        
        // Add proper indentation
        const PADDING = '  ';
        const reg = /(>)(<)(\/*)/g;
        let pad = 0;
        
        formatted = formatted.replace(reg, '$1\r\n$2$3');
        
        return formatted.split('\r\n').map((node, index) => {
            let indent = 0;
            if (node.match(/.+<\/\w[^>]*>$/)) {
                indent = 0;
            } else if (node.match(/^<\/\w/) && pad > 0) {
                pad -= 1;
            } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
                indent = 1;
            } else {
                indent = 0;
            }
            
            pad += indent;
            
            return PADDING.repeat(pad - indent) + node;
        }).join('\r\n');
    } catch (e) {
        // If formatting fails, return original
        return xml;
    }
}

function saveEditedXML() {
    if (!xmlEditArea || !xmlEditArea.value) {
        showStatus('No XML to save', true);
        return;
    }
    
    try {
        const editedXml = xmlEditArea.value.trim();
        // Update the stored XML
        currentWSCOXmlRaw = editedXml;
        // Re-display the tree
        displayXMLTree(editedXml);
        hideEditMode();
        showStatus('XML updated successfully');
    } catch (error) {
        showStatus('Error saving XML: ' + error.message, true);
    }
}

function closeXMLTree() {
    if (xmlTreeOverlay) {
        xmlTreeOverlay.style.display = 'none';
    }
}

function toggleXMLNode(nodeId) {
    const node = document.getElementById(nodeId);
    if (!node) return;
    
    const xmlElement = node.closest('.xml-element');
    if (!xmlElement) return;
    
    const toggle = xmlElement.querySelector('.xml-toggle');
    if (!toggle) return;
    
    if (node.classList.contains('collapsed')) {
        node.classList.remove('collapsed');
        toggle.classList.add('expanded');
    } else {
        node.classList.add('collapsed');
        toggle.classList.remove('expanded');
    }
}

// Make toggleXMLNode available globally
window.toggleXMLNode = toggleXMLNode;

// Monitor iframe for XML content - specifically listening for <ComergentData>
function checkIframeForXML() {
    if (currentMode !== 'wsco' || !wscoIframe) return;
    
    try {
        const iframeDoc = wscoIframe.contentDocument || wscoIframe.contentWindow.document;
        if (!iframeDoc) return;
        
        // Try multiple methods to find XML content - PRIORITIZE ComergentData
        let xmlContent = '';
        let foundComergentData = false;
        
        // Method 1: Check if the page itself is XML (browser XML view)
        // When browser displays XML directly, the document itself is XML
        // Try to serialize the XML document directly
        try {
            // Check if documentElement is XML (not HTML)
            const docElement = iframeDoc.documentElement;
            if (docElement && docElement.nodeType === Node.ELEMENT_NODE) {
                // PRIORITY: Check if root element is ComergentData
                if (docElement.tagName === 'ComergentData' || docElement.tagName === 'comergentdata') {
                    foundComergentData = true;
                    const serializer = new XMLSerializer();
                    let serialized = serializer.serializeToString(iframeDoc);
                    
                    if (!serialized.trim().startsWith('<?xml')) {
                        serialized = '<?xml version="1.0" encoding="UTF-8"?>\n' + serialized;
                    }
                    
                    xmlContent = serialized;
                    if (xmlContent && xmlContent.trim()) {
                        console.log('Found ComergentData as root element!');
                        displayXMLTree(xmlContent);
                        return;
                    }
                }
                
                // Check if it's an XML document (not HTML)
                // Chrome displays XML directly, so check for any XML root element
                if (docElement.tagName !== 'HTML' && docElement.tagName !== 'html') {
                    // This might be an XML document - try to serialize it
                    const serializer = new XMLSerializer();
                    let serialized = serializer.serializeToString(iframeDoc);
                    
                    // Check if it contains ComergentData
                    if (serialized && serialized.includes('<ComergentData>')) {
                        foundComergentData = true;
                        console.log('Found ComergentData in XML document!');
                    }
                    
                    // Check if it looks like XML (has XML structure)
                    if (serialized && serialized.includes('<') && serialized.includes('>') && 
                        (serialized.includes('</') || serialized.trim().startsWith('<?xml'))) {
                        // Keep XML declaration if present, otherwise remove it
                        // We want to preserve the full XML structure
                        if (!serialized.trim().startsWith('<?xml')) {
                            // Add XML declaration if missing
                            serialized = '<?xml version="1.0" encoding="UTF-8"?>\n' + serialized;
                        }
                        
                        xmlContent = serialized;
                        
                        // If we got XML, display it immediately as tree
                        if (xmlContent && xmlContent.trim()) {
                            displayXMLTree(xmlContent);
                            return;
                        }
                    }
                }
            }
        } catch (e) {
            // Not an XML document or CORS error, continue with other methods
            console.log('Method 1 failed:', e.message);
        }
        
        // If Method 1 didn't work, try getting from body HTML (preserves structure)
        // PRIORITY: Look for ComergentData first
        if (!xmlContent) {
            const bodyHtml = iframeDoc.body ? (iframeDoc.body.innerHTML || '') : '';
            const bodyText = iframeDoc.body ? (iframeDoc.body.textContent || iframeDoc.body.innerText || '') : '';
            
            // PRIORITY CHECK: Look specifically for ComergentData tags
            if (bodyText.includes('<ComergentData>') || bodyHtml.includes('<ComergentData>') || bodyHtml.includes('&lt;ComergentData&gt;')) {
                foundComergentData = true;
                console.log('Detected ComergentData tag in iframe content!');
            }
            
            // Check if body HTML contains XML structure (not just text)
            if (bodyHtml && bodyHtml.includes('<') && bodyHtml.includes('</')) {
                // PRIORITY: Try to extract ComergentData first
                const comergentDataMatch = bodyHtml.match(/<[?]xml[\s\S]*?<\/ComergentData>/i) || 
                                         bodyHtml.match(/<ComergentData[\s\S]*?<\/ComergentData>/i) ||
                                         bodyHtml.match(/&lt;[?]xml[\s\S]*?&lt;\/ComergentData&gt;/i) ||
                                         bodyHtml.match(/&lt;ComergentData[\s\S]*?&lt;\/ComergentData&gt;/i);
                
                if (comergentDataMatch) {
                    foundComergentData = true;
                    console.log('Found ComergentData match in HTML!');
                    xmlContent = comergentDataMatch[0];
                    // Decode HTML entities if needed
                    if (xmlContent.includes('&lt;') || xmlContent.includes('&gt;')) {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = xmlContent;
                        xmlContent = tempDiv.textContent || tempDiv.innerText || xmlContent;
                    }
                } else {
                    // Fallback to other XML patterns
                    const xmlMatch = bodyHtml.match(/<[?]xml[\s\S]*?<\/Comergent>/i) ||
                                   bodyHtml.match(/<Comergent[\s\S]*?<\/Comergent>/i);
                    if (xmlMatch) {
                        xmlContent = xmlMatch[0];
                        // Decode HTML entities if needed
                        if (xmlContent.includes('&lt;') || xmlContent.includes('&gt;')) {
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = xmlContent;
                            xmlContent = tempDiv.textContent || tempDiv.innerText || xmlContent;
                        }
                    }
                }
            }
            
            // Also check text content - PRIORITIZE ComergentData
            if (!xmlContent && bodyText) {
                if (bodyText.includes('<ComergentData>')) {
                    foundComergentData = true;
                    console.log('Found ComergentData in text content!');
                    // Extract ComergentData specifically
                    let xmlStart = bodyText.indexOf('<ComergentData>');
                    if (xmlStart === -1) {
                        xmlStart = bodyText.indexOf('<?xml');
                    }
                    if (xmlStart >= 0) {
                        let xmlEnd = bodyText.lastIndexOf('</ComergentData>');
                        if (xmlEnd > xmlStart) {
                            xmlContent = bodyText.substring(xmlStart, xmlEnd + '</ComergentData>'.length);
                        }
                    }
                } else if (bodyText.trim().startsWith('<?xml') || bodyText.trim().startsWith('<ComergentData>') || bodyText.trim().startsWith('<Comergent>')) {
                    // Fallback: extract from text if HTML extraction didn't work
                    // Prioritize XML declaration and ComergentData
                    let xmlStart = bodyText.indexOf('<?xml');
                    if (xmlStart === -1) {
                        xmlStart = bodyText.indexOf('<ComergentData>');
                    }
                    if (xmlStart === -1) {
                        xmlStart = bodyText.indexOf('<Comergent>');
                    }
                    if (xmlStart === -1) {
                        xmlStart = bodyText.indexOf('<');
                    }
                    
                    if (xmlStart >= 0) {
                        // Find the closing tag - prioritize ComergentData
                        let xmlEnd = bodyText.lastIndexOf('</ComergentData>');
                        if (xmlEnd === -1) {
                            xmlEnd = bodyText.lastIndexOf('</Comergent>');
                        }
                        if (xmlEnd > xmlStart) {
                            const closingTag = bodyText.lastIndexOf('</ComergentData>') > -1 ? '</ComergentData>' : '</Comergent>';
                            xmlContent = bodyText.substring(xmlStart, xmlEnd + closingTag.length);
                        } else {
                            const lastBracket = bodyText.lastIndexOf('>');
                            if (lastBracket > xmlStart) {
                                xmlContent = bodyText.substring(xmlStart, lastBracket + 1);
                            }
                        }
                    }
                }
            }
        }
        
        // Method 2: Look for pre/code tags with XML (most common in HTML pages)
        // PRIORITY: Check for ComergentData first
        if (!xmlContent) {
            const preElements = iframeDoc.querySelectorAll('pre, code, textarea');
            for (let elem of preElements) {
                const text = elem.textContent || elem.innerText || '';
                // PRIORITY: Check for ComergentData first
                if (text.includes('<ComergentData>')) {
                    foundComergentData = true;
                    console.log('Found ComergentData in pre/code element!');
                    xmlContent = text.trim();
                    break;
                } else if (text.trim().startsWith('<?xml') || 
                    (text.trim().startsWith('<') && (text.includes('</') || text.includes('<Comergent')))) {
                    xmlContent = text.trim();
                    break;
                }
            }
        }
        
        // Method 3: Check innerHTML for XML (for HTML-encoded XML)
        if (!xmlContent && bodyHtml) {
            // Look for XML that might be HTML-encoded or in HTML structure
            // Prioritize patterns with XML declaration
            const xmlMatch = bodyHtml.match(/<[?]xml[\s\S]*?<\/ComergentData>/i) || 
                           bodyHtml.match(/<ComergentData[\s\S]*?<\/ComergentData>/i) ||
                           bodyHtml.match(/<[?]xml[\s\S]*?<\/Comergent>/i) ||
                           bodyHtml.match(/<Comergent[\s\S]*?<\/Comergent>/i) ||
                           bodyHtml.match(/&lt;[?]xml[\s\S]*?&lt;\/ComergentData&gt;/i) ||
                           bodyHtml.match(/&lt;ComergentData[\s\S]*?&lt;\/ComergentData&gt;/i);
            if (xmlMatch) {
                xmlContent = xmlMatch[0];
                // Decode HTML entities if needed
                if (xmlContent.includes('&lt;')) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = xmlContent;
                    xmlContent = tempDiv.textContent || tempDiv.innerText || xmlContent;
                }
            }
        }
        
        // Method 4: Check for XML in any div or body
        if (!xmlContent) {
            const allElements = iframeDoc.querySelectorAll('div, body');
            for (let elem of allElements) {
                const text = elem.textContent || elem.innerText || '';
                // Prioritize XML declaration
                if (text.trim().startsWith('<?xml') || 
                    (text.trim().startsWith('<') && (text.includes('</Comergent') || text.includes('</ComergentData') || text.includes('<Comergent')))) {
                    // Extract just the XML portion - prioritize XML declaration
                    let xmlStart = text.indexOf('<?xml');
                    if (xmlStart === -1) {
                        xmlStart = text.indexOf('<ComergentData>');
                    }
                    if (xmlStart === -1) {
                        xmlStart = text.indexOf('<Comergent>');
                    }
                    if (xmlStart === -1) {
                        xmlStart = text.indexOf('<');
                    }
                    
                    if (xmlStart >= 0) {
                        let closingTag = text.lastIndexOf('</ComergentData>');
                        if (closingTag === -1) {
                            closingTag = text.lastIndexOf('</Comergent>');
                        }
                        if (closingTag > xmlStart) {
                            const closingTagText = text.lastIndexOf('</ComergentData>') > -1 ? '</ComergentData>' : '</Comergent>';
                            xmlContent = text.substring(xmlStart, closingTag + closingTagText.length);
                        } else {
                            const lastBracket = text.lastIndexOf('>');
                            if (lastBracket > xmlStart) {
                                xmlContent = text.substring(xmlStart, lastBracket + 1);
                            }
                        }
                    }
                    if (xmlContent) break;
                }
            }
        }
        
        if (xmlContent && xmlContent.trim()) {
            // Clean and display - ensure we have valid XML
            xmlContent = xmlContent.trim();
            
            // Check if this is the same XML we already displayed (avoid duplicate displays)
            if (xmlContent === lastDetectedXML) {
                return; // Already displayed this XML
            }
            
            // If we have ComergentData wrapper, use it; otherwise wrap if needed
            if (!xmlContent.includes('<ComergentData>') && xmlContent.includes('<Comergent>')) {
                // Check if we should wrap it
                const comergentCount = (xmlContent.match(/<Comergent>/g) || []).length;
                if (comergentCount > 1) {
                    // Multiple Comergent blocks - wrap in ComergentData
                    xmlContent = '<ComergentData>\n' + xmlContent + '\n</ComergentData>';
                }
            }
            
            // Log if we found ComergentData
            if (foundComergentData || xmlContent.includes('<ComergentData>')) {
                console.log('✓ ComergentData detected and displaying!');
                lastDetectedXML = xmlContent; // Store to avoid duplicates
            }
            
            // Always try to display as Chrome-style tree
            displayXMLTree(xmlContent);
        } else {
            // No XML found yet - try one more time to serialize the entire document
            // This handles cases where Chrome displays XML but we haven't detected it
            try {
                const docElement = iframeDoc.documentElement;
                if (docElement && docElement.nodeType === Node.ELEMENT_NODE && docElement.tagName !== 'HTML') {
                    // Try to serialize the entire document
                    const serializer = new XMLSerializer();
                    const serialized = serializer.serializeToString(iframeDoc);
                    
                    // If it looks like XML (has proper XML structure)
                    if (serialized && serialized.trim().startsWith('<') && 
                        (serialized.includes('</') || serialized.includes('<?xml'))) {
                        xmlContent = serialized.replace(/<\?xml[^>]*\?>\s*/i, '').trim();
                        if (xmlContent) {
                            displayXMLTree(xmlContent);
                            return;
                        }
                    }
                }
            } catch (e) {
                // Not XML document or CORS error
            }
        }
    } catch (error) {
        // CORS or other error - silently fail, user can still use the iframe
        console.error('Error checking iframe for XML:', error);
    }
}

// Navigation functions for iframe
function navigateWSCOBack() {
    try {
        if (wscoIframe && wscoIframe.contentWindow) {
            wscoIframe.contentWindow.history.back();
            updateWSCOUrl();
        }
    } catch (error) {
        showStatus('Cannot navigate: ' + error.message, true);
    }
}

function navigateWSCOForward() {
    try {
        if (wscoIframe && wscoIframe.contentWindow) {
            wscoIframe.contentWindow.history.forward();
            updateWSCOUrl();
        }
    } catch (error) {
        showStatus('Cannot navigate: ' + error.message, true);
    }
}

function refreshWSCO() {
    try {
        if (wscoIframe) {
            // Reload the iframe
            const currentSrc = wscoIframe.src;
            wscoIframe.src = '';
            setTimeout(() => {
                wscoIframe.src = currentSrc;
                updateWSCOUrl();
            }, 10);
        }
    } catch (error) {
        showStatus('Cannot refresh: ' + error.message, true);
    }
}

function updateWSCOUrl() {
    try {
        if (wscoIframe && wscoIframe.contentWindow) {
            const url = wscoIframe.contentWindow.location.href;
            if (chromeAddressInput) {
                chromeAddressInput.value = url;
            }
            // Update tab title
            if (chromeTabTitle) {
                try {
                    const iframeDoc = wscoIframe.contentDocument || wscoIframe.contentWindow.document;
                    const title = iframeDoc.title || 'WSCO Search';
                    chromeTabTitle.textContent = title.length > 20 ? title.substring(0, 20) + '...' : title;
                } catch (e) {
                    // CORS - can't access title
                }
            }
        }
    } catch (error) {
        // CORS - can't access URL, keep default
    }
}

function updateWSCONavButtons() {
    // Enable buttons by default - let them try to navigate
    // CORS will prevent actual navigation if needed, but buttons should be enabled
    if (wscoBackBtn) {
        wscoBackBtn.disabled = false;
    }
    if (wscoForwardBtn) {
        wscoForwardBtn.disabled = false;
    }
}

// Poll iframe for changes and use MutationObserver to listen for ComergentData
let iframeCheckInterval = null;
let iframeMutationObserver = null;
let lastDetectedXML = ''; // Track last detected XML to avoid duplicate displays

function startIframeMonitoring() {
    if (iframeCheckInterval) {
        clearInterval(iframeCheckInterval);
    }
    // More frequent polling when actively looking for ComergentData
    iframeCheckInterval = setInterval(checkIframeForXML, 500); // Check every 500ms for faster detection
    
    // Also try to set up MutationObserver for real-time detection
    try {
        const iframeDoc = wscoIframe.contentDocument || wscoIframe.contentWindow.document;
        if (iframeDoc && iframeDoc.body) {
            // Stop existing observer if any
            if (iframeMutationObserver) {
                iframeMutationObserver.disconnect();
            }
            
            // Create MutationObserver to watch for DOM changes
            iframeMutationObserver = new MutationObserver((mutations) => {
                // Check if any mutation might have added ComergentData
                let shouldCheck = false;
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.TEXT_NODE) {
                                if (node.textContent && node.textContent.includes('<ComergentData>')) {
                                    shouldCheck = true;
                                }
                            } else if (node.nodeType === Node.ELEMENT_NODE) {
                                if (node.textContent && node.textContent.includes('<ComergentData>')) {
                                    shouldCheck = true;
                                }
                            }
                        });
                    }
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        shouldCheck = true;
                    }
                });
                
                if (shouldCheck) {
                    console.log('DOM mutation detected, checking for ComergentData...');
                    // Debounce the check slightly
                    setTimeout(() => {
                        checkIframeForXML();
                    }, 100);
                }
            });
            
            // Start observing
            iframeMutationObserver.observe(iframeDoc.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
            
            console.log('MutationObserver set up to watch for ComergentData');
        }
    } catch (e) {
        console.log('Could not set up MutationObserver (CORS restriction):', e.message);
        // Fall back to polling only
    }
}

function stopIframeMonitoring() {
    if (iframeCheckInterval) {
        clearInterval(iframeCheckInterval);
        iframeCheckInterval = null;
    }
    if (iframeMutationObserver) {
        iframeMutationObserver.disconnect();
        iframeMutationObserver = null;
    }
    lastDetectedXML = '';
}

// Event listeners
orderModeBtn.addEventListener('click', () => switchMode('order'));
xmlModeBtn.addEventListener('click', () => switchMode('xml'));
wscoModeBtn.addEventListener('click', () => {
    switchMode('wsco');
    // Start monitoring after a short delay to let iframe load
    setTimeout(() => {
        startIframeMonitoring();
        updateWSCONavButtons();
        updateWSCOUrl();
    }, 1000);
});
if (closeXmlTreeBtn) {
    closeXmlTreeBtn.addEventListener('click', closeXMLTree);
}
if (editXmlBtn) {
    editXmlBtn.addEventListener('click', showEditMode);
}
if (saveXmlBtn) {
    saveXmlBtn.addEventListener('click', saveEditedXML);
}
if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', hideEditMode);
}
// Handle address bar navigation
if (chromeAddressInput) {
    chromeAddressInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const url = chromeAddressInput.value.trim();
            if (url && wscoIframe) {
                // Add http:// if no protocol specified
                let fullUrl = url;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    fullUrl = 'http://' + url;
                }
                wscoIframe.src = fullUrl;
                chromeAddressInput.value = fullUrl;
            }
        }
    });
}
if (wscoBackBtn) {
    wscoBackBtn.addEventListener('click', navigateWSCOBack);
}
if (wscoForwardBtn) {
    wscoForwardBtn.addEventListener('click', navigateWSCOForward);
}
if (wscoRefreshBtn) {
    wscoRefreshBtn.addEventListener('click', refreshWSCO);
}
if (chromeReloadBtn) {
    chromeReloadBtn.addEventListener('click', refreshWSCO);
}

// Update navigation buttons periodically when in WSCO mode
function startNavMonitoring() {
    if (navCheckInterval) {
        clearInterval(navCheckInterval);
    }
    navCheckInterval = setInterval(() => {
        if (currentMode === 'wsco') {
            updateWSCONavButtons();
            updateWSCOUrl();
        }
    }, 1000);
}

function stopNavMonitoring() {
    if (navCheckInterval) {
        clearInterval(navCheckInterval);
        navCheckInterval = null;
    }
}

let navCheckInterval = null;
convertBtn.addEventListener('click', convertXML);
reverseConvertBtn.addEventListener('click', reverseConvertXML);
copyBtn.addEventListener('click', copyToClipboard);
downloadBtn.addEventListener('click', downloadXML);

// Allow Enter key to convert (Ctrl+Enter or Cmd+Enter)
inputArea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        convertXML();
    }
});

// Auto-resize textareas based on content
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(500, textarea.scrollHeight) + 'px';
}

            if (inputArea) {
                inputArea.addEventListener('input', () => autoResize(inputArea));
            }
            if (outputArea) {
                outputArea.addEventListener('input', () => autoResize(outputArea));
            }
        }
