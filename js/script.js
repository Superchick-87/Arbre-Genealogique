let data, root;
let nextId = 200;
let currentNodeForModal = null;
let sortableChildren = null; // Pour le glisser-déposer des enfants
let globalMap = null;
let tooltipMap = null;
let hideTooltipTimeout = null;
let i = 0;
const duration = 750;

const nodeWidth = 220,
  nodeHeight = 90;
const verticalSpacing = 180;

const svg = d3
  .select("#tree-container")
  .append("svg")
  .attr("width", window.innerWidth)
  .attr("height", window.innerHeight);
const g = svg.append("g");
const gLinks = g.append("g").attr("class", "links");
const gNodes = g.append("g").attr("class", "nodes");
const zoomBehavior = d3
  .zoom()
  .scaleExtent([0.1, 3])
  .on("zoom", (event) => g.attr("transform", event.transform));
svg.call(zoomBehavior);

const tooltip = d3.select("#tooltip");
const modal = document.getElementById("familyModal");

const treeLayout = d3.tree().nodeSize([nodeWidth + 40, verticalSpacing]);

fetch("./datas/datas.json", { cache: "no-cache" })
  .then((res) => res.json())
  .then((json) => {
    data = json;
    root = d3.hierarchy(data, (d) => d.children);
    root.x0 = window.innerWidth / 2;
    root.y0 = 50;
    nextId = findMaxId(data) + 1;
    update(root);
    setTimeout(centerAndFitTree, duration + 50);
  });

function update(source) {
  const treeData = treeLayout(root);
  let nodes = treeData.descendants();
  let links = treeData.links();

  const node = gNodes
    .selectAll("g.node")
    .data(nodes, (d) => d.id || (d.id = ++i));

  const nodeEnter = node
    .enter()
    .append("g")
    .attr("class", "node")
    .attr("transform", `translate(${source.x0},${source.y0})`);

  nodeEnter
    .append("rect")
    .attr("width", nodeWidth)
    .attr("height", nodeHeight)
    .attr("x", -nodeWidth / 2)
    .attr("y", -nodeHeight / 2)
    .on("click", (event, d) => {
      toggleChildren(d);
    })
    .on("dblclick", (event) => {
      event.stopPropagation();
    });

  const fo = nodeEnter
    .append("foreignObject")
    .attr("x", -nodeWidth / 2)
    .attr("y", -nodeHeight / 2)
    .attr("width", nodeWidth)
    .attr("height", nodeHeight)
    .style("pointer-events", "none");

  fo.append("xhtml:div")
    .attr("class", "node-html-content")
    .html((d) => getHtmlContent(d.data));

  const dragHandler = d3
    .drag()
    .on("start", (event) => {
      d3.select(event.sourceEvent.target.closest(".node")).raise();
    })
    .on("drag", (event, d) => {
      const descendants = d.descendants();
      descendants.forEach((node) => {
        node.x += event.dx;
        node.y += event.dy;
      });
      gNodes
        .selectAll("g.node")
        .filter((n) => descendants.includes(n))
        .attr("transform", (n) => `translate(${n.x}, ${n.y})`);
      gLinks.selectAll("path.link").attr(
        "d",
        d3
          .linkVertical()
          .x((n) => n.x)
          .y((n) => n.y)
      );
    });

  nodeEnter
    .append("circle")
    .attr("class", "drag-handle")
    .attr("r", 8)
    .attr("cy", -nodeHeight / 2)
    .call(dragHandler);

  const editHandle = nodeEnter
    .append("g")
    .attr("class", "edit-handle")
    .attr(
      "transform",
      `translate(${nodeWidth / 2 - 16}, ${-nodeHeight / 2 + 16})`
    )
    .on("click", (event, d) => {
      event.stopPropagation();
      openModal(d.data);
    });

  editHandle.append("circle").attr("class", "edit-handle-bg").attr("r", 10);
  editHandle
    .append("path")
    .attr("class", "edit-handle-icon")
    .attr(
      "d",
      "M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z"
    )
    .attr("transform", "translate(-12, -12) scale(1)");

  const nodeUpdate = nodeEnter.merge(node);
  nodeUpdate
    .transition()
    .duration(duration)
    .attr("transform", (d) => `translate(${d.x},${d.y})`);

  nodeUpdate
    .select("rect")
    .style("stroke", (d) => (d._children ? "#aaa" : "steelblue"))
    .style("stroke-dasharray", (d) =>
      d.children || d._children ? "4" : "none"
    );

  const nodeExit = node
    .exit()
    .transition()
    .duration(duration)
    .attr("transform", `translate(${source.x},${source.y})`)
    .style("opacity", 0)
    .remove();

  nodes.forEach((d) => {
    d.x0 = d.x;
    d.y0 = d.y;
  });

  const link = gLinks.selectAll("path.link").data(links, (d) => d.target.id);
  const linkEnter = link
    .enter()
    .insert("path", "g")
    .attr("class", "link")
    .attr("d", (d) => {
      const o = { x: source.x0, y: source.y0 };
      return d3
        .linkVertical()
        .x((n) => n.x)
        .y((n) => n.y)({ source: o, target: o });
    });

  linkEnter
    .merge(link)
    .transition()
    .duration(duration)
    .attr(
      "d",
      d3
        .linkVertical()
        .x((n) => n.x)
        .y((n) => n.y)
    );

  link
    .exit()
    .transition()
    .duration(duration)
    .attr("d", (d) => {
      const o = { x: source.x, y: source.y };
      return d3
        .linkVertical()
        .x((n) => n.x)
        .y((n) => n.y)({ source: o, target: o });
    })
    .remove();

  nodeUpdate.each(function (d) {
    const node = d3.select(this);
    node
      .selectAll(".person-container")
      .style("pointer-events", "auto")
      .on("click", (event) => {
        event.stopPropagation();
        toggleChildren(d);
      })
      .on("mouseover", (event) => {
        const personType = d3
          .select(event.currentTarget)
          .attr("data-person-type");
        const personData = personType === "spouse" ? d.data.spouse : d.data;
        if (personData) {
          showTooltip(event, personData, personType === "spouse");
        }
      })
      .on("mouseout", () => {
        hideTooltipTimeout = setTimeout(hideTooltip, 300);
      });
  });
}

function toggleChildren(d) {
  if (d.children) {
    d._children = d.children;
    d.children = null;
  } else {
    d.children = d._children;
    d._children = null;
  }
  update(d);
}

function getHtmlContent(p_data) {
  const p1 = p_data;
  const p2 = p_data.spouse;

  const renderPerson = (p, isSpouse) => {
    const defaultImage = isSpouse ? "visu_parent_2.png" : "visu_parent_1.png";
    const photoSrc = p.photo ? `images/${p.photo}` : `images/${defaultImage}`;
    return `
      <div class="person-container" data-person-type="${
        isSpouse ? "spouse" : "primary"
      }">
        <img src="${photoSrc}" class="person-photo" alt="Photo de ${
      p.prenom || ""
    }" onerror="this.onerror=null;this.src='images/visu_default.png';"/>
        <div class="person-details">
          <div class="name">${p.prenom || ""} ${p.nom || ""}</div>
          <div class="life-years">${getLifeYears(p)}</div>
        </div>
      </div>`;
  };

  let p1_html = renderPerson(p1, false);
  let p2_html = p2
    ? `<hr class="spouse-separator">` + renderPerson(p2, true)
    : "";

  return p1_html + p2_html;
}

function getLifeYears(p) {
  if (!p || !p.naissance) return "";
  const birthYear = new Date(p.naissance).getFullYear();
  const deathYear = p.deces ? new Date(p.deces).getFullYear() : "";
  return `(${birthYear} - ${deathYear})`;
}

function getTooltipContent(p, isSpouse) {
  if (!p) return "";

  const defaultImage = isSpouse ? "visu_parent_2.png" : "visu_parent_1.png";
  const photoSrc = p.photo ? `images/${p.photo}` : `images/${defaultImage}`;

  let details = [];

  let headerHtml = `
    <div class="tooltip-header">
      <img src="${photoSrc}" class="tooltip-photo" alt="Photo de ${
    p.prenom || ""
  }" onerror="this.onerror=null;this.src='images/${defaultImage}';"/>
      <div class="tooltip-names">
        <div class="name">${p.prenom || ""} ${p.nom || ""}</div>
        <div class="life-years">${getLifeYears(p)}</div>
      </div>
    </div>
    <div id="tooltip-details">
  `;

  if (p.profession) details.push(`<b>Profession:</b> ${p.profession}`);
  if (p.lieu_naissance?.nom)
    details.push(`<b>Né(e) à:</b> ${p.lieu_naissance.nom}`);
  if (p.lieu_deces?.nom) details.push(`<b>Mort(e) à:</b> ${p.lieu_deces.nom}`);
  if (p.evenement) details.push(`<b>Événement:</b> ${p.evenement}`);
  if (p.infos) details.push(`<b>Infos:</b> ${p.infos}`);

  let detailsHtml = details.join("<br>");

  return (
    headerHtml + detailsHtml + `</div><div id="tooltip-map-container"></div>`
  );
}

function previewImage(input, previewId) {
  const preview = document.getElementById(previewId);
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      preview.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function centerAndFitTree() {
  const bounds = g.node().getBBox();
  const fullWidth = svg.attr("width"),
    fullHeight = svg.attr("height");
  if (bounds.width === 0 || bounds.height === 0) return;
  const midX = bounds.x + bounds.width / 2,
    midY = bounds.y + bounds.height / 2;
  const scale =
    0.9 * Math.min(fullWidth / bounds.width, fullHeight / bounds.height);
  const translateX = fullWidth / 2 - midX * scale;
  const translateY = 50 - bounds.y * scale;
  const transform = d3.zoomIdentity
    .translate(translateX, translateY)
    .scale(scale);
  svg.transition().duration(duration).call(zoomBehavior.transform, transform);
}

function openModal(nodeData) {
  modal.innerHTML = getModalHtml();
  currentNodeForModal = nodeData;

  const parentNode = findParentNode(root, nodeData.id);
  document.getElementById("add_parents_button").style.display =
    null === parentNode ? "block" : "none";
  document.getElementById("add_parents_section").style.display = "none";

  // Remplissage des champs pour Parent 1
  [
    "prenom",
    "nom",
    "naissance",
    "deces",
    "profession",
    "evenement",
    "infos",
  ].forEach((f) => {
    document.getElementById(`modal_p1_${f}`).value = nodeData[f] || "";
  });
  document.getElementById("modal_p1_lieu_naissance_nom").value =
    nodeData.lieu_naissance?.nom || "";
  document.getElementById("modal_p1_lieu_deces_nom").value =
    nodeData.lieu_deces?.nom || "";
  document.getElementById("modal_p1_lieu_naissance_gps").value =
    nodeData.lieu_naissance?.gps || "";
  document.getElementById("modal_p1_lieu_deces_gps").value =
    nodeData.lieu_deces?.gps || "";

  document.getElementById("modal_p1_photo_preview").src = nodeData.photo
    ? `images/${nodeData.photo}`
    : "images/visu_parent_1.png";
  document.getElementById("modal_p1_photo").dataset.currentPhoto =
    nodeData.photo || "";

  // Remplissage des champs pour Parent 2
  const p2 = nodeData.spouse || {};
  [
    "prenom",
    "nom",
    "naissance",
    "deces",
    "profession",
    "evenement",
    "infos",
  ].forEach((f) => {
    document.getElementById(`modal_p2_${f}`).value = p2[f] || "";
  });
  document.getElementById("modal_p2_lieu_naissance_nom").value =
    p2.lieu_naissance?.nom || "";
  document.getElementById("modal_p2_lieu_deces_nom").value =
    p2.lieu_deces?.nom || "";
  document.getElementById("modal_p2_lieu_naissance_gps").value =
    p2.lieu_naissance?.gps || "";
  document.getElementById("modal_p2_lieu_deces_gps").value =
    p2.lieu_deces?.gps || "";

  document.getElementById("modal_p2_photo_preview").src = p2.photo
    ? `images/${p2.photo}`
    : "images/visu_parent_2.png";
  document.getElementById("modal_p2_photo").dataset.currentPhoto =
    p2.photo || "";

  // Remplissage de la liste des enfants
  const childrenListDiv = document.getElementById("modal_children_list");
  childrenListDiv.innerHTML = "";
  // Gère les enfants visibles et cachés (pliés)
  const childrenToShow =
    nodeData.children ||
    (nodeData._children ? nodeData._children.map((d) => d.data) : null);
  if (childrenToShow) {
    childrenToShow.forEach((child) =>
      childrenListDiv.appendChild(createChildListItem(child))
    );
  }

  modal.style.display = "block";
  initAllAutocompletes();

  // Initialisation du glisser-déposer
  if (sortableChildren) {
    sortableChildren.destroy();
  }
  const childrenListEl = document.getElementById("modal_children_list");
  sortableChildren = new Sortable(childrenListEl, {
    animation: 150,
    handle: ".child-header",
  });
}

function createChildListItem(childData) {
  const div = document.createElement("div");
  const uniqueId = `child_${childData.id || Date.now()}`;
  div.className = "child-item";
  div.dataset.id = childData.id || `new_${Date.now()}`;
  const displayName =
    `${childData.prenom || ""} ${childData.nom || ""}`.trim() ||
    "(Nouvel enfant)";
  const photoSrc = childData.photo
    ? `images/${childData.photo}`
    : "images/visu_default.png";

  div.innerHTML = `
        <div class="child-header">
            <span>${displayName}</span>
            <button type="button" onclick="toggleChildDetails(this)">Éditer</button>
            <button type="button" onclick="this.parentElement.parentElement.remove()">Supprimer</button>
        </div>
        <div class="child-details">
            <div class="photo-uploader">
                <img id="preview_${uniqueId}" src="${photoSrc}" alt="Aperçu Enfant" class="photo-preview" onerror="this.onerror=null;this.src='images/visu_default.png';"/>
                <input type="file" id="photo_${uniqueId}" data-field="photo" accept="image/png, image/jpeg" onchange="previewImage(this, 'preview_${uniqueId}')" data-current-photo="${
    childData.photo || ""
  }">
            </div>
            Prénom: <input type="text" data-field="prenom" value="${
              childData.prenom || ""
            }">
            Nom: <input type="text" data-field="nom" value="${
              childData.nom || ""
            }">
            Naissance: <input type="date" data-field="naissance" value="${
              childData.naissance || ""
            }">
            <div class="location-grid">
                <input type="text" data-field="lieu_naissance_nom" class="autocomplete-location" value="${
                  childData.lieu_naissance?.nom || ""
                }" placeholder="Lieu de naissance">
                <input type="text" data-field="lieu_naissance_gps" value="${
                  childData.lieu_naissance?.gps || ""
                }" placeholder="GPS lat,lon" readonly>
            </div>
            Décès: <input type="date" data-field="deces" value="${
              childData.deces || ""
            }">
            <div class="location-grid">
                <input type="text" data-field="lieu_deces_nom" class="autocomplete-location" value="${
                  childData.lieu_deces?.nom || ""
                }" placeholder="Lieu de décès">
                <input type="text" data-field="lieu_deces_gps" value="${
                  childData.lieu_deces?.gps || ""
                }" placeholder="GPS lat,lon" readonly>
            </div>
            Profession: <input type="text" data-field="profession" value="${
              childData.profession || ""
            }">
            Événement: <input type="text" data-field="evenement" value="${
              childData.evenement || ""
            }">
            Infos: <input type="text" data-field="infos" value="${
              childData.infos || ""
            }">
        </div>`;
  return div;
}

function toggleChildDetails(button) {
  const detailsDiv = button.parentElement.nextElementSibling;
  detailsDiv.style.display =
    detailsDiv.style.display === "block" ? "none" : "block";
}

function addChildToModalList() {
  const newChildData = { id: null, prenom: "", nom: "" };
  const childItem = createChildListItem(newChildData);
  document.getElementById("modal_children_list").appendChild(childItem);
  childItem.querySelectorAll(".autocomplete-location").forEach((input) => {
    if (!input.id)
      input.id = `child_loc_${Math.random().toString(36).substr(2, 9)}`;
    initAutocomplete(`#${input.id}`);
  });
  toggleChildDetails(childItem.querySelector(".child-header button"));
}

function swapParentData() {
  const fieldsToSwap = [
    "prenom",
    "nom",
    "naissance",
    "deces",
    "profession",
    "evenement",
    "infos",
    "lieu_naissance_nom",
    "lieu_naissance_gps",
    "lieu_deces_nom",
    "lieu_deces_gps",
  ];

  fieldsToSwap.forEach((field) => {
    const p1_field = document.getElementById(`modal_p1_${field}`);
    const p2_field = document.getElementById(`modal_p2_${field}`);
    const tempValue = p1_field.value;
    p1_field.value = p2_field.value;
    p2_field.value = tempValue;
  });

  const p1_photo_preview = document.getElementById("modal_p1_photo_preview");
  const p2_photo_preview = document.getElementById("modal_p2_photo_preview");
  const p1_photo_input = document.getElementById("modal_p1_photo");
  const p2_photo_input = document.getElementById("modal_p2_photo");

  const tempSrc = p1_photo_preview.src;
  p1_photo_preview.src = p2_photo_preview.src;
  p2_photo_preview.src = tempSrc;

  const tempCurrentPhoto = p1_photo_input.dataset.currentPhoto;
  p1_photo_input.dataset.currentPhoto = p2_photo_input.dataset.currentPhoto;
  p2_photo_input.dataset.currentPhoto = tempCurrentPhoto;

  p1_photo_input.value = "";
  p2_photo_input.value = "";
}

function saveAllChangesFromModal() {
  if (!currentNodeForModal) return;

  const originalNodeState = findNodeById(root, currentNodeForModal.id);
  if (!originalNodeState) {
    console.error(
      "Erreur critique: Nœud original introuvable avant sauvegarde."
    );
    return;
  }
  const sourcePos = { x: originalNodeState.x, y: originalNodeState.y };

  const formData = new FormData();
  let dataToSave = JSON.parse(JSON.stringify(data));
  let nodeInCopy = findNodeById(
    d3.hierarchy(dataToSave),
    currentNodeForModal.id
  ).data;

  const readPersonForm = (prefix, personObject, fileInput) => {
    [
      "prenom",
      "nom",
      "naissance",
      "deces",
      "profession",
      "evenement",
      "infos",
    ].forEach((f) => {
      personObject[f] = document.getElementById(`${prefix}${f}`)?.value || null;
    });
    personObject.lieu_naissance = {
      nom:
        document.getElementById(`${prefix}lieu_naissance_nom`)?.value || null,
      gps:
        document.getElementById(`${prefix}lieu_naissance_gps`)?.value || null,
    };
    personObject.lieu_deces = {
      nom: document.getElementById(`${prefix}lieu_deces_nom`)?.value || null,
      gps: document.getElementById(`${prefix}lieu_deces_gps`)?.value || null,
    };

    if (fileInput && fileInput.files[0]) {
      const file = fileInput.files[0];
      const extension = file.name.slice(
        ((file.name.lastIndexOf(".") - 1) >>> 0) + 2
      );
      const newFileName = `${Date.now()}.${extension}`;

      personObject.photo = newFileName;
      formData.append(newFileName, file);
    } else if (fileInput) {
      personObject.photo = fileInput.dataset.currentPhoto || null;
    }
    return personObject;
  };

  readPersonForm(
    "modal_p1_",
    nodeInCopy,
    document.getElementById("modal_p1_photo")
  );

  const spousePrenom = document.getElementById("modal_p2_prenom").value;
  const spouseFileInput = document.getElementById("modal_p2_photo");
  if (spousePrenom || (spouseFileInput && spouseFileInput.files[0])) {
    if (!nodeInCopy.spouse) nodeInCopy.spouse = { id: nextId++ };
    readPersonForm("modal_p2_", nodeInCopy.spouse, spouseFileInput);
  } else {
    delete nodeInCopy.spouse;
  }

  const newChildrenArray = [];
  document
    .querySelectorAll("#modal_children_list .child-item")
    .forEach((item) => {
      const childId = isNaN(parseInt(item.dataset.id))
        ? nextId++
        : parseInt(item.dataset.id);
      const originalChildData =
        findNodeById(root, parseInt(item.dataset.id))?.data || {};

      const q = (field) => item.querySelector(`[data-field="${field}"]`);

      let childData = {
        id: childId,
        prenom: q("prenom").value,
        nom: q("nom").value,
        naissance: q("naissance").value || null,
        lieu_naissance: {
          nom: q("lieu_naissance_nom").value || null,
          gps: q("lieu_naissance_gps").value || null,
        },
        deces: q("deces").value || null,
        lieu_deces: {
          nom: q("lieu_deces_nom").value || null,
          gps: q("lieu_deces_gps").value || null,
        },
        profession: q("profession").value || null,
        evenement: q("evenement").value || null,
        infos: q("infos").value || null,
        children: originalChildData.children || [],
        spouse: originalChildData.spouse || null,
        photo: q("photo").dataset.currentPhoto || null,
      };

      const fileInput = q("photo");
      if (fileInput && fileInput.files[0]) {
        const file = fileInput.files[0];
        const extension = file.name.slice(
          ((file.name.lastIndexOf(".") - 1) >>> 0) + 2
        );
        const newFileName = `${Date.now()}.${extension}`;

        childData.photo = newFileName;
        formData.append(newFileName, file);
      }
      newChildrenArray.push(childData);
    });
  nodeInCopy.children = newChildrenArray.length > 0 ? newChildrenArray : null;
  // Conserver les enfants cachés s'il n'y en avait pas dans le modal
  if (newChildrenArray.length === 0 && currentNodeForModal._children) {
    delete nodeInCopy.children;
    nodeInCopy._children = currentNodeForModal._children;
  }

  formData.append("jsonData", JSON.stringify(dataToSave));

  fetch("save.php", {
    method: "POST",
    body: formData,
  })
    .then((res) => res.json())
    .then((response) => {
      console.log("Sauvegarde:", response.message);
      data = dataToSave;
      root = d3.hierarchy(data, (d) => d.children);
      const newSourceNode = findNodeById(root, currentNodeForModal.id) || root;

      if (newSourceNode) {
        newSourceNode.x0 = sourcePos.x;
        newSourceNode.y0 = sourcePos.y;
      }

      update(newSourceNode);
      closeModal();
    })
    .catch((error) => console.error("Erreur de sauvegarde:", error));
}

function toggleAddParentsSection() {
  const section = document.getElementById("add_parents_section");
  section.style.display = section.style.display === "none" ? "block" : "none";
}

function addParentsToCurrentNode() {
  if (!currentNodeForModal) return;
  const p1prenom = document.getElementById("new_parent1_prenom").value,
    p1nom = document.getElementById("new_parent1_nom").value;
  if (!p1prenom && !p1nom) {
    alert("Le prénom ou le nom du Parent 1 est requis.");
    return;
  }
  const newParentNode = {
    id: nextId++,
    prenom: p1prenom,
    nom: p1nom,
    children: [currentNodeForModal],
  };
  const p2prenom = document.getElementById("new_parent2_prenom").value;
  if (p2prenom) {
    newParentNode.spouse = {
      id: nextId++,
      prenom: p2prenom,
      nom: document.getElementById("new_parent2_nom").value || p1nom,
    };
  }
  data = newParentNode;
  closeModal();
  root = d3.hierarchy(data, (d) => d.children);
  root.x0 = window.innerHeight / 2;
  root.y0 = 0;
  update(root);

  const formData = new FormData();
  formData.append("jsonData", JSON.stringify(data));
  fetch("save.php", { method: "POST", body: formData });
}

function closeModal() {
  modal.style.display = "none";
  currentNodeForModal = null;

  if (sortableChildren) {
    sortableChildren.destroy();
    sortableChildren = null;
  }
}

function findParentNode(startNode, id) {
  if (startNode.data?.id === id) return null;
  for (const child of startNode.children || []) {
    if (child.data.id === id) return startNode;
    const found = findParentNode(child, id);
    if (found) return found;
  }
  for (const child of startNode._children || []) {
    if (child.data.id === id) return startNode;
    const found = findParentNode(child, id);
    if (found) return found;
  }
  return null;
}

function findNodeById(startNode, id) {
  if (!id || !startNode) return null;
  let result = null;
  function search(node) {
    if (node.data.id === id) {
      result = node;
      return;
    }
    if (result) return;
    if (node.children) node.children.forEach(search);
    if (node._children) node._children.forEach(search);
  }
  search(startNode);
  return result;
}

function findMaxId(node) {
  if (!node) return 0;
  let maxId = node.id || 0;
  if (node.spouse && node.spouse.id) maxId = Math.max(maxId, node.spouse.id);
  if (node.children)
    node.children.forEach((c) => (maxId = Math.max(maxId, findMaxId(c))));
  return maxId;
}

function initAutocomplete(selector) {
  new autoComplete({
    selector: selector,
    placeHolder: "Nom de la ville...",
    data: {
      src: async (query) => {
        try {
          const source = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${query}&addressdetails=1&countrycodes=fr`
          );
          return await source.json();
        } catch (error) {
          console.error(error);
          return [];
        }
      },
      keys: ["display_name"],
      cache: !1,
    },
    resultsList: {
      render: true,
      destination: selector,
      position: "beforebegin",
    },
    resultItem: {
      element: (item, data) => {
        const address = data.value.address;
        let city = data.value.display_name.split(",")[0],
          region = address.state || address.county || "",
          country = address.country || "";
        item.innerHTML = `<span style="display: block;">${city}</span><span style="font-size: 10px; color: #888;">${region}, ${country}</span>`;
      },
      highlight: !0,
    },
    events: {
      input: {
        selection: (event) => {
          const selectedPlace = event.detail.selection.value,
            inputField = document.querySelector(selector);
          inputField.value = selectedPlace.display_name.split(",")[0];
          const locationGrid = inputField.closest(".location-grid"),
            gpsField = locationGrid.querySelector(
              'input[placeholder="GPS lat,lon"]'
            );
          if (gpsField) {
            const lat = parseFloat(selectedPlace.lat).toFixed(4),
              lon = parseFloat(selectedPlace.lon).toFixed(4);
            gpsField.value = `${lat}, ${lon}`;
          }
        },
      },
    },
  });

  const inputField = document.querySelector(selector);
  inputField.addEventListener("input", (event) => {
    if (event.target.value === "") {
      const locationGrid = event.target.closest(".location-grid");
      if (locationGrid) {
        const gpsField = locationGrid.querySelector(
          'input[placeholder="GPS lat,lon"]'
        );
        if (gpsField) {
          gpsField.value = "";
        }
      }
    }
  });
}

function initAllAutocompletes() {
  document.querySelectorAll(".autocomplete-location").forEach((input) => {
    input.id || (input.id = `loc_${Math.random().toString(36).substr(2, 9)}`),
      initAutocomplete(`#${input.id}`);
  });
}

function parseGps(gpsString) {
  if (!gpsString || "string" != typeof gpsString) return null;
  const parts = gpsString.split(",").map((coord) => parseFloat(coord.trim()));
  return 2 === parts.length && !isNaN(parts[0]) && !isNaN(parts[1])
    ? parts
    : null;
}

function showGlobalMap() {
  const mapModal = document.getElementById("global-map-modal");
  (mapModal.style.display = "block"),
    globalMap && globalMap.remove(),
    (globalMap = L.map("global-map-container")),
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
      globalMap
    );
  let allPoints = [];
  collectAllGpsPoints(root, allPoints);
  if (allPoints.length > 0) {
    const markers = allPoints.map((p) => L.marker(p.coords).bindPopup(p.text)),
      markerGroup = L.featureGroup(markers).addTo(globalMap);
    const paddedBounds = markerGroup.getBounds().pad(0.1);
    globalMap.fitBounds(paddedBounds);
  } else globalMap.setView([47, 2.2], 5);
  setTimeout(() => globalMap.invalidateSize(), 10);
}

function hideGlobalMap() {
  document.getElementById("global-map-modal").style.display = "none";
}

function collectAllGpsPoints(node, points) {
  if (!node) return;
  const p1 = node.data,
    p2 = node.data.spouse,
    p1_birth = parseGps(p1.lieu_naissance?.gps);
  p1_birth &&
    points.push({
      coords: p1_birth,
      text: `Naissance de ${p1.prenom} ${p1.nom}`,
    });
  const p1_death = parseGps(p1.lieu_deces?.gps);
  p1_death &&
    points.push({
      coords: p1_death,
      text: `Décès de ${p1.prenom} ${p1.nom}`,
    });
  if (p2) {
    const p2_birth = parseGps(p2.lieu_naissance?.gps);
    p2_birth &&
      points.push({
        coords: p2_birth,
        text: `Naissance de ${p2.prenom} ${p2.nom}`,
      });
    const p2_death = parseGps(p2.lieu_deces?.gps);
    p2_death &&
      points.push({
        coords: p2_death,
        text: `Décès de ${p2.prenom} ${p2.nom}`,
      });
  }
  if (node.children)
    for (const child of node.children) collectAllGpsPoints(child, points);
  if (node._children)
    for (const child of node._children) collectAllGpsPoints(child, points);
}

function showTooltip(event, personData, isSpouse) {
  clearTimeout(hideTooltipTimeout);
  const content = getTooltipContent(personData, isSpouse);

  tooltip.html(content);

  tooltip
    .style("display", "block")
    .style("left", event.pageX + 20 + "px")
    .style("top", event.pageY + 20 + "px");

  updateTooltipMap(personData);
}

function hideTooltip() {
  tooltip.style("display", "none");
}

function updateTooltipMap(personData) {
  if (!document.getElementById("tooltip-map-container")) return;

  if (tooltipMap) {
    tooltipMap.remove();
    tooltipMap = null;
  }

  tooltipMap = L.map("tooltip-map-container", { zoomControl: false });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OSM",
  }).addTo(tooltipMap);

  tooltip.on("mouseover", () => clearTimeout(hideTooltipTimeout));
  tooltip.on(
    "mouseout",
    () => (hideTooltipTimeout = setTimeout(hideTooltip, 300))
  );

  let markers = [];
  let p1_birth = parseGps(personData.lieu_naissance?.gps);
  if (p1_birth) markers.push(L.marker(p1_birth));

  let p1_death = parseGps(personData.lieu_deces?.gps);
  if (p1_death) markers.push(L.marker(p1_death));

  if (markers.length > 0) {
    const markerGroup = L.featureGroup(markers).addTo(tooltipMap);
    const paddedBounds = markerGroup.getBounds().pad(0.3);
    tooltipMap.fitBounds(paddedBounds);
  } else {
    tooltipMap.setView([47, 2.2], 4);
  }

  setTimeout(() => tooltipMap.invalidateSize(), 10);
}

function getModalHtml() {
  return `<div class="modal-content">
        <span class="modal-close" onclick="closeModal()">&times;</span>
        <h2>Éditeur de Famille</h2>

        <div class="modal-parents-container">
            <div class="modal-parents-grid">
                <fieldset>
                    <legend>Parent 1</legend>
                    <div class="photo-uploader">
                        <img id="modal_p1_photo_preview" src="images/visu_parent_1.png" alt="Aperçu Parent 1" class="photo-preview"/>
                        <input type="file" id="modal_p1_photo" accept="image/png, image/jpeg" onchange="previewImage(this, 'modal_p1_photo_preview')">
                    </div>
                    Prénom: <input type="text" id="modal_p1_prenom">
                    Nom: <input type="text" id="modal_p1_nom">
                    Naissance: <input type="date" id="modal_p1_naissance">
                    <div class="location-grid"><input type="text" id="modal_p1_lieu_naissance_nom" class="autocomplete-location" placeholder="Lieu de naissance"><input type="text" id="modal_p1_lieu_naissance_gps" placeholder="GPS lat,lon" readonly></div>
                    Décès: <input type="date" id="modal_p1_deces">
                    <div class="location-grid"><input type="text" id="modal_p1_lieu_deces_nom" class="autocomplete-location" placeholder="Lieu de décès"><input type="text" id="modal_p1_lieu_deces_gps" placeholder="GPS lat,lon" readonly></div>
                    Profession: <input type="text" id="modal_p1_profession">
                    Événement: <input type="text" id="modal_p1_evenement">
                    Infos: <input type="text" id="modal_p1_infos">
                </fieldset>
                <fieldset>
                    <legend>Parent 2 (Conjoint)</legend>
                    <div class="photo-uploader">
                        <img id="modal_p2_photo_preview" src="images/visu_parent_2.png" alt="Aperçu Parent 2" class="photo-preview"/>
                        <input type="file" id="modal_p2_photo" accept="image/png, image/jpeg" onchange="previewImage(this, 'modal_p2_photo_preview')">
                    </div>
                    Prénom: <input type="text" id="modal_p2_prenom">
                    Nom: <input type="text" id="modal_p2_nom">
                    Naissance: <input type="date" id="modal_p2_naissance">
                    <div class="location-grid"><input type="text" id="modal_p2_lieu_naissance_nom" class="autocomplete-location" placeholder="Lieu de naissance"><input type="text" id="modal_p2_lieu_naissance_gps" placeholder="GPS lat,lon" readonly></div>
                    Décès: <input type="date" id="modal_p2_deces">
                    <div class="location-grid"><input type="text" id="modal_p2_lieu_deces_nom" class="autocomplete-location" placeholder="Lieu de décès"><input type="text" id="modal_p2_lieu_deces_gps" placeholder="GPS lat,lon" readonly></div>
                    Profession: <input type="text" id="modal_p2_profession">
                    Événement: <input type="text" id="modal_p2_evenement">
                    Infos: <input type="text" id="modal_p2_infos">
                </fieldset>
            </div>
          <button type="button" class="swap-button" title="Intervertir Parent 1 et 2" onclick="swapParentData()">
              &#x21C6; 
          </button>
        </div>

        <hr>
        <fieldset>
            <legend>Enfants</legend>
            <div id="modal_children_list"></div>
            <div style="margin-top:15px; padding-top:15px; border-top: 1px dashed #ccc;">
                <strong>Ajouter un enfant :</strong>
                <button type="button" onclick="addChildToModalList()">+</button>
            </div>
        </fieldset>
        <div id="add_parents_section" class="modal-section" style="display: none;">
            <h4>Ajouter des parents</h4>
            <div class="modal-parents-grid">
                <fieldset><legend>Nouveau Parent 1</legend>Prénom: <input type="text" id="new_parent1_prenom"> Nom: <input type="text" id="new_parent1_nom"></fieldset>
                <fieldset><legend>Nouveau Parent 2</legend>Prénom: <input type="text" id="new_parent2_prenom"> Nom: <input type="text" id="new_parent2_nom"></fieldset>
            </div>
            <button onclick="addParentsToCurrentNode()" style="margin-top:10px;">Confirmer</button>
        </div>
        <div class="modal-footer">
            <button id="add_parents_button" onclick="toggleAddParentsSection()" style="float:left; display:none;">Ajouter des parents</button>
            <button onclick="closeModal()">Annuler</button>
            <button onclick="saveAllChangesFromModal()" style="font-weight:bold;">Enregistrer</button>
        </div>
    </div>`;
}

window.onclick = function (event) {
  if (event.target == modal) closeModal();
};
