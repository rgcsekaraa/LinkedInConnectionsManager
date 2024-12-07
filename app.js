// ==UserScript==
// @name         LinkedIn Connections Manager
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  Automatically fetch first name and company name, insert into LinkedIn modal, and track daily invitation sends with multi-tab synchronization. Includes a sidebar opener button with animated chevron, ability to edit template titles and messages directly in the UI, selection option, and a styled "Add New Template" button.
// @match        https://www.linkedin.com/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
  'use strict';

  // Constants for localStorage keys
  const COUNTER_KEY = 'linkedinInviteCounter';
  const DATE_KEY = 'linkedinLastResetDate';
  const TEMPLATES_KEY = 'linkedinMessageTemplates';
  const ACTIVE_TEMPLATE_KEY = 'linkedinActiveTemplate';

  // Default message templates with titles
  const defaultTemplates = [
    {
      title: 'Template 1',
      message: `Hi {firstName},

Hope you're having a great week! I admire the work you and the team at {companyName} are doing, and I'd love to be part of the team someday. It would be great to connect if you're open to it. Thank you for your time :)`,
    },
    {
      title: 'Template 2',
      message: `Hello {firstName},

I came across your profile and was impressed by your work at {companyName}. I'd love to connect and learn more about your experiences.`,
    },
    {
      title: 'Template 3',
      message: `Dear {firstName},

Your contributions at {companyName} caught my eye. It would be great to connect and possibly collaborate in the future.`,
    },
  ];

  // Initialize the UI elements
  function createUI() {
    // Counter UI
    const counterDiv = document.createElement('div');
    counterDiv.id = 'inviteCounter';
    counterDiv.style.position = 'fixed';
    counterDiv.style.top = '5px';
    counterDiv.style.right = '10px';
    counterDiv.style.padding = '10px 15px';
    counterDiv.style.backgroundColor = '#0073b1';
    counterDiv.style.color = '#fff';
    counterDiv.style.fontSize = '12px'; // Reduced font size
    counterDiv.style.borderRadius = '5px';
    counterDiv.style.zIndex = '1000';
    counterDiv.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
    counterDiv.style.cursor = 'pointer';
    counterDiv.title = 'Click to reset counter';
    document.body.appendChild(counterDiv);

    counterDiv.addEventListener('click', resetCounter);
    updateCounterUI();

    // Sidebar opener button with chevron
    const openerButton = document.createElement('div');
    openerButton.id = 'openerButton';
    openerButton.style.position = 'fixed';
    openerButton.style.top = '50%';
    openerButton.style.right = '0';
    openerButton.style.transform = 'translateY(-50%)';
    openerButton.style.padding = '8px';
    openerButton.style.backgroundColor = '#0073b1';
    openerButton.style.color = '#fff';
    openerButton.style.borderTopLeftRadius = '8px';
    openerButton.style.borderBottomLeftRadius = '8px';
    openerButton.style.zIndex = '1000';
    openerButton.style.cursor = 'pointer';
    openerButton.style.transition = 'all 0.3s ease';
    openerButton.style.display = 'flex';
    openerButton.style.alignItems = 'center';
    openerButton.style.justifyContent = 'center';
    openerButton.style.width = '32px';
    openerButton.style.height = '40px';

    // Create SVG elements programmatically
    const svgNS = 'http://www.w3.org/2000/svg';
    const chevronSVG = document.createElementNS(svgNS, 'svg');
    chevronSVG.setAttribute('width', '24');
    chevronSVG.setAttribute('height', '24');
    chevronSVG.setAttribute('viewBox', '0 0 24 24');
    chevronSVG.setAttribute('style', 'display: block;');

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z');
    path.setAttribute('fill', 'white');

    chevronSVG.appendChild(path);
    openerButton.appendChild(chevronSVG);
    document.body.appendChild(openerButton);

    openerButton.addEventListener('click', toggleSidebar);

    // Sidebar for managing templates
    const sidebar = document.createElement('div');
    sidebar.id = 'templateSidebar';
    sidebar.style.position = 'fixed';
    sidebar.style.top = '0';
    sidebar.style.right = '-300px'; // Hidden by default
    sidebar.style.width = '300px';
    sidebar.style.height = '100%';
    sidebar.style.backgroundColor = '#f1f1f1';
    sidebar.style.borderLeft = '1px solid #ccc';
    sidebar.style.zIndex = '999'; // Set zIndex lower than openerButton
    sidebar.style.transition = 'right 0.3s ease';
    sidebar.style.padding = '10px';
    sidebar.style.overflowY = 'auto';
    sidebar.style.fontSize = '12px'; // Reduced font size

    document.body.appendChild(sidebar);

    // Template manager UI
    const templatesHeader = document.createElement('h3');
    templatesHeader.textContent = 'Manage Templates';
    templatesHeader.style.marginTop = '33px';
    templatesHeader.style.marginBottom = '10px';
    templatesHeader.style.fontSize = '16px'; // Reduced font size

    sidebar.appendChild(templatesHeader);

    const templatesList = document.createElement('ul');
    templatesList.id = 'templatesList';
    templatesList.style.listStyleType = 'none'; // Remove bullet points
    templatesList.style.padding = '0'; // Remove padding

    sidebar.appendChild(templatesList);

    const addTemplateButton = document.createElement('button');
    addTemplateButton.textContent = 'Add New Template';
    addTemplateButton.style.marginTop = '10px';
    addTemplateButton.style.backgroundColor = '#0073b1'; // LinkedIn blue
    addTemplateButton.style.color = '#fff';
    addTemplateButton.style.border = 'none';
    addTemplateButton.style.padding = '10px 15px';
    addTemplateButton.style.borderRadius = '5px';
    addTemplateButton.style.cursor = 'pointer';
    addTemplateButton.style.fontSize = '12px'; // Reduced font size
    addTemplateButton.addEventListener('mouseenter', () => {
      addTemplateButton.style.backgroundColor = '#005f8d'; // Darker blue on hover
    });
    addTemplateButton.addEventListener('mouseleave', () => {
      addTemplateButton.style.backgroundColor = '#0073b1';
    });
    addTemplateButton.addEventListener('click', addNewTemplate);
    sidebar.appendChild(addTemplateButton);

    loadTemplates();
    renderTemplates();
  }

  const googleScriptUrl =
    'https://script.google.com/macros/s/AKfycbw5TEhD6O62E25bqBMkQY-YTSwwZnxkchXvRNVmkAcBE3eG0NYOXyaXA5UebeJKLhqI4A/exec';

   function logToGoogleSheet(name, companyName, profileUrl) {
  const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbygD3E3p3E6kX7BfgRPRcrGaPS-gPQwKz4BCp5_8p7wHbT3DEbTQEWXPUEu5T1NosxZ5A/exec';

  // Format timestamp to separate date and time
  const now = new Date();
  const date = now.toLocaleDateString(); // E.g., "11/29/2024"
  const time = now.toLocaleTimeString(); // E.g., "10:15:30 AM"

  // Extract position
  const firstJobEntry = document.querySelector('li.artdeco-list__item');
  const titleElement = firstJobEntry?.querySelector(
    '.display-flex.align-items-center.mr1.t-bold span[aria-hidden="true"]'
  );
  const position = titleElement ? titleElement.textContent.trim() : '[Position Unknown]';

  // Debugging logs for verification
  console.log('Position element:', titleElement);
  console.log('Extracted Position:', position);

  const data = {
    date: date,
    time: time,
    url: profileUrl,
    name: name,
    company: companyName,
    position: position,
  };

  GM_xmlhttpRequest({
    method: 'POST',
    url: googleScriptUrl,
    headers: {
      'Content-Type': 'application/json',
    },
    data: JSON.stringify(data),
    onload: function (response) {
      if (response.status === 200) {
        console.log('Data logged successfully:', response.responseText);
      } else {
        console.error('Failed to log data:', response.status, response.responseText);
      }
    },
    onerror: function (error) {
      console.error('Error logging to Google Sheets:', error);
    },
  });
}



  // Function to toggle sidebar visibility
  function toggleSidebar() {
    const sidebar = document.getElementById('templateSidebar');
    const openerButton = document.getElementById('openerButton');
    const chevron = openerButton.querySelector('svg');

    if (sidebar.style.right === '0px') {
      sidebar.style.right = '-300px'; // Hide sidebar
      openerButton.style.right = '0';
      chevron.style.transform = 'rotate(0deg)';
    } else {
      sidebar.style.right = '0px'; // Show sidebar
      openerButton.style.right = '300px';
      chevron.style.transform = 'rotate(180deg)';
    }
  }

  // Function to load templates from localStorage
  function loadTemplates() {
    let templates = JSON.parse(localStorage.getItem(TEMPLATES_KEY));
    if (!templates || !Array.isArray(templates) || templates.length === 0) {
      templates = defaultTemplates;
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    } else {
      // Handle backward compatibility
      if (typeof templates[0] === 'string') {
        templates = templates.map((message, index) => ({
          title: `Template ${index + 1}`,
          message: message,
        }));
        localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
      }
    }
    return templates;
  }

  // Function to save templates to localStorage
  function saveTemplates(templates) {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  }

  // Function to render templates in the sidebar
  function renderTemplates() {
    const templates = loadTemplates();
    const templatesList = document.getElementById('templatesList');
    templatesList.innerHTML = ''; // Clear existing list

    const activeTemplateIndex =
      parseInt(localStorage.getItem(ACTIVE_TEMPLATE_KEY)) || 0;

    templates.forEach((template, index) => {
      const listItem = document.createElement('li');
      listItem.style.marginBottom = '10px';
      listItem.style.borderBottom = '1px solid #ccc';
      listItem.style.padding = '10px';
      listItem.style.backgroundColor = '#fff';
      listItem.style.borderRadius = '5px';
      listItem.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      listItem.style.fontSize = '12px'; // Reduced font size

      // Highlight the active template
      if (index === activeTemplateIndex) {
        listItem.style.backgroundColor = '#bddcff'; // Light blue color
      } else {
        listItem.style.backgroundColor = '#fff'; // Default background
      }

      // Top row: Radio button, Title, Edit, Delete
      const topRow = document.createElement('div');
      topRow.style.display = 'flex';
      topRow.style.alignItems = 'center';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'activeTemplate';
      radio.value = index;
      radio.checked = index === activeTemplateIndex;
      radio.id = `templateRadio${index}`;
      radio.style.marginRight = '5px';

      radio.addEventListener('change', () => {
        localStorage.setItem(ACTIVE_TEMPLATE_KEY, index);
        fillMessage();
      });

      topRow.appendChild(radio);

      const titleLabel = document.createElement('span');
      titleLabel.textContent = template.title || `Template ${index + 1}`;
      titleLabel.style.fontWeight = 'bold';
      titleLabel.style.flexGrow = '1';
      titleLabel.style.fontSize = '14px'; // Reduced font size
      titleLabel.style.cursor = 'pointer';

      // Add hover effect
      titleLabel.addEventListener('mouseover', () => {
        titleLabel.style.color = '#0073b1'; // LinkedIn blue
      });

      titleLabel.addEventListener('mouseout', () => {
        titleLabel.style.color = '#000'; // Default color (black)
      });

      titleLabel.addEventListener('click', (e) => {
        e.stopPropagation();
        localStorage.setItem(ACTIVE_TEMPLATE_KEY, index);
        renderTemplates();
        fillMessage();
      });

      topRow.appendChild(titleLabel);

      // Title input (hidden by default)
      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.value = template.title;
      titleInput.style.display = 'none';
      titleInput.style.flexGrow = '1';
      titleInput.style.marginRight = '5px';
      titleInput.style.fontSize = '12px'; // Reduced font size
      topRow.appendChild(titleInput);

      const editButton = document.createElement('button');
      editButton.textContent = 'Edit';
      editButton.style.backgroundColor = '#0073b1'; // LinkedIn blue
      editButton.style.border = '2px solid #0073b1';
      editButton.style.padding = '5px 10px';
      editButton.style.borderRadius = '5px';
      editButton.style.color = '#fff';
      editButton.style.marginLeft = '5px';
      editButton.style.cursor = 'pointer';
      editButton.style.fontSize = '12px'; // Reduced font size
      editButton.addEventListener('click', () => toggleEditTemplate(index));
      topRow.appendChild(editButton);

      const saveButton = document.createElement('button');
      saveButton.textContent = 'Save';
      saveButton.style.backgroundColor = '#0073b1'; // LinkedIn blue
      saveButton.style.border = '2px solid #0073b1';
      saveButton.style.padding = '5px 10px';
      saveButton.style.borderRadius = '5px';
      saveButton.style.color = '#fff';
      saveButton.style.marginLeft = '5px';
      saveButton.style.display = 'none';
      saveButton.style.cursor = 'pointer';
      saveButton.style.fontSize = '12px'; // Reduced font size
      saveButton.addEventListener('click', () =>
        saveEditedTemplate(index, titleInput.value, messageTextarea.value)
      );
      topRow.appendChild(saveButton);

      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.style.backgroundColor = '#ff0000'; // Red color
      deleteButton.style.border = '2px solid #ff0000';
      deleteButton.style.padding = '5px 10px';
      deleteButton.style.borderRadius = '5px';
      deleteButton.style.color = '#fff';
      deleteButton.style.marginLeft = '5px';
      deleteButton.style.cursor = 'pointer';
      deleteButton.style.fontSize = '12px'; // Reduced font size
      deleteButton.addEventListener('click', () => deleteTemplate(index));
      topRow.appendChild(deleteButton);

      listItem.appendChild(topRow);

      // Description/message
      const contentDiv = document.createElement('div');
      contentDiv.style.border = '1px solid #ccc';
      contentDiv.style.borderRadius = '5px';
      contentDiv.style.padding = '10px';
      contentDiv.style.backgroundColor = '#f9f9f9';
      contentDiv.style.marginTop = '10px';

      // Message textarea (hidden by default)
      const messageTextarea = document.createElement('textarea');
      messageTextarea.value = template.message;
      messageTextarea.style.display = 'none';
      messageTextarea.style.width = '100%';
      messageTextarea.style.height = '80px';
      messageTextarea.style.fontSize = '12px'; // Reduced font size
      contentDiv.appendChild(messageTextarea);

      // Displayed message text
      const messageText = document.createElement('p');
      messageText.textContent = template.message;
      messageText.style.whiteSpace = 'pre-wrap';
      messageText.style.fontSize = '12px'; // Reduced font size
      contentDiv.appendChild(messageText);

      listItem.appendChild(contentDiv);
      templatesList.appendChild(listItem);
    });
  }

  // Function to toggle edit mode for a template
  function toggleEditTemplate(index) {
    const templatesList = document.getElementById('templatesList');
    const listItem = templatesList.children[index];
    const topRow = listItem.children[0];
    const contentDiv = listItem.children[1];

    const titleLabel = topRow.querySelector('span');
    const titleInput = topRow.querySelector('input[type="text"]');
    const editButton = topRow.querySelector('button:nth-child(4)');
    const saveButton = topRow.querySelector('button:nth-child(5)');

    const messageText = contentDiv.querySelector('p');
    const messageTextarea = contentDiv.querySelector('textarea');

    const isEditing = titleInput.style.display === 'block';

    if (isEditing) {
      // Switch to display mode
      titleLabel.textContent = titleInput.value || `Template ${index + 1}`;
      titleLabel.style.display = 'block';
      titleInput.style.display = 'none';

      messageText.textContent = messageTextarea.value;
      messageText.style.display = 'block';
      messageTextarea.style.display = 'none';

      editButton.style.display = 'inline-block';
      saveButton.style.display = 'none';
    } else {
      // Switch to edit mode
      titleInput.value = titleLabel.textContent;
      titleLabel.style.display = 'none';
      titleInput.style.display = 'block';

      messageTextarea.value = messageText.textContent;
      messageText.style.display = 'none';
      messageTextarea.style.display = 'block';

      editButton.style.display = 'none';
      saveButton.style.display = 'inline-block';
    }
  }

  // Function to save edited template
  function saveEditedTemplate(index, newTitle, newMessage) {
    const templates = loadTemplates();
    templates[index].title = newTitle;
    templates[index].message = newMessage;
    saveTemplates(templates);
    renderTemplates();
  }

  // Function to add a new template
  function addNewTemplate() {
    const templates = loadTemplates();
    const newTemplate = {
      title: 'New Template',
      message: 'Your message here...',
    };
    templates.push(newTemplate);
    saveTemplates(templates);
    renderTemplates();

    // Automatically enter edit mode for the new template
    toggleEditTemplate(templates.length - 1);
  }

  // Function to delete a template
  function deleteTemplate(index) {
    const templates = loadTemplates();
    if (templates.length > 1) {
      templates.splice(index, 1);
      saveTemplates(templates);

      // Update active template index if necessary
      let activeTemplateIndex =
        parseInt(localStorage.getItem(ACTIVE_TEMPLATE_KEY)) || 0;
      if (activeTemplateIndex === index) {
        activeTemplateIndex = 0;
        localStorage.setItem(ACTIVE_TEMPLATE_KEY, activeTemplateIndex);
      } else if (activeTemplateIndex > index) {
        activeTemplateIndex -= 1;
        localStorage.setItem(ACTIVE_TEMPLATE_KEY, activeTemplateIndex);
      }

      renderTemplates();
    } else {
      alert('You must have at least one template.');
    }
  }

  // Counter functions
  function getCounter() {
    const today = new Date().toISOString().split('T')[0];
    const lastReset = localStorage.getItem(DATE_KEY);

    if (lastReset !== today) {
      localStorage.setItem(DATE_KEY, today);
      localStorage.setItem(COUNTER_KEY, '0');
    }

    return parseInt(localStorage.getItem(COUNTER_KEY) || '0', 10);
  }

  function incrementCounter() {
    const count = getCounter() + 1;
    localStorage.setItem(COUNTER_KEY, count.toString());
    updateCounterUI();
  }

  function resetCounter() {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(DATE_KEY, today);
    localStorage.setItem(COUNTER_KEY, '0');
    updateCounterUI();
  }

  function updateCounterUI() {
    const counterDiv = document.getElementById('inviteCounter');
    if (counterDiv) {
      counterDiv.textContent = `Invites Sent: ${getCounter()}`;
    }
  }

// Synchronize UI across tabs
window.addEventListener('storage', (event) => {
  if (
    event.key === COUNTER_KEY ||
    event.key === DATE_KEY ||
    event.key === ACTIVE_TEMPLATE_KEY ||
    event.key === TEMPLATES_KEY
  ) {
    // Update the counter if needed
    if (event.key === COUNTER_KEY || event.key === DATE_KEY) {
      updateCounterUI();
    }

    // If the active template or templates list changed, re-render the template list and refill the message
    if (event.key === ACTIVE_TEMPLATE_KEY || event.key === TEMPLATES_KEY) {
      renderTemplates();
      fillMessage();
    }
  }
});


  // Click "Add a note" by default
  function autoClickAddNote() {
    const addNoteButton = document.querySelector(
      'button[aria-label="Add a note"]'
    );
    if (addNoteButton && !addNoteButton.disabled) {
      addNoteButton.click();
    }
  }

  // Observe for the modal opening
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      const connectModal = document.querySelector('.artdeco-modal');
      if (connectModal && connectModal.style.display !== 'none') {
        // Automatically click "Add a note" if the modal appears
        autoClickAddNote();

        const messageBox = document.getElementById('custom-message');
        if (messageBox && !messageBox.value) {
          fillMessage();
        }

        // Add event listener to the "Send" button
        const sendButton = connectModal.querySelector(
          'button[aria-label="Send now"], button[aria-label="Send"], button[aria-label="Send invitation"]'
        );

        if (sendButton && !sendButton.dataset.listenerAdded) {
          sendButton.dataset.listenerAdded = 'true';

          sendButton.addEventListener('click', () => {
            console.log('Send button clicked'); // Debug line
            incrementCounter();

            // Extract necessary details for logging
            const profileUrl = window.location.href;

            // Extract the first name
            const nameElement = document.querySelector(
              'h1.inline.t-24.v-align-middle.break-words'
            );
            const name = nameElement
              ? nameElement.textContent.trim().split(' ')[0]
              : '[Name]';

            // Extract the company name
            const companyElement =
              document.querySelector(
                'button[aria-label^="Current company"] div.inline-show-more-text--is-collapsed'
              ) ||
              document.querySelector(
                '.pv-entity__secondary-title, span.pv-text-details__right-panel-item'
              );
            const companyName = companyElement
              ? companyElement.textContent.trim()
              : '[Company Name]';

            // Log the details to Google Sheet
            logToGoogleSheet(name, companyName, profileUrl);
          });
        }
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Function to fill the message with placeholders replaced
  function fillMessage() {
    const messageBox = document.getElementById('custom-message');
    if (messageBox) {
      // Fetch the full name element using a more reliable selector
      let fullNameElement = document.querySelector(
        'h1.inline.t-24.v-align-middle.break-words'
      );
      let firstName = '[Their First Name]';

      // Extract the first name if the element exists
      if (fullNameElement) {
        const fullName = fullNameElement.textContent.trim();
        firstName = fullName.split(' ')[0]; // Get the first part of the name
      }

      // Fetch company name
      let companyElement =
        document.querySelector(
          'button[aria-label^="Current company"] div.inline-show-more-text--is-collapsed'
        ) ||
        document.querySelector(
          '.pv-entity__secondary-title, span.pv-text-details__right-panel-item'
        );

      let companyName = '[Company Name]';
      if (companyElement) {
        companyName = companyElement.textContent.trim();
      }

      // Get active template
      const templates = loadTemplates();
      const activeTemplateIndex =
        parseInt(localStorage.getItem(ACTIVE_TEMPLATE_KEY)) || 0;
      const template = templates[activeTemplateIndex] || templates[0];
      let messageTemplate = template.message;

      // Replace placeholders
      messageTemplate = messageTemplate
        .replace(/{firstName}/g, firstName)
        .replace(/{companyName}/g, companyName);

      // Insert message into textarea
      messageBox.value = messageTemplate;

      // Trigger input event
      messageBox.dispatchEvent(new Event('input', { bubbles: true }));

      // Enable "Send" button if necessary
      const sendButton = document.querySelector(
        'button[aria-label="Send now"], button[aria-label="Send"]'
      );
      if (sendButton) {
        sendButton.removeAttribute('disabled');
      }
    }
  }

  // Initialize the UI
  createUI();
})();
