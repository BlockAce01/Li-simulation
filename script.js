document.addEventListener('DOMContentLoaded', () => {
    // --- MASTER DATA ---
    const masterData = {
        productSKUs: [
            { id: 1, name: "IPA - 330ml Can", brand: "Crafty Ales", flavor: "Hoppy", type: "Can" },
            { id: 2, name: "Stout - 50L Keg", brand: "Dark Horse", flavor: "Rich", type: "Keg" },
            { id: 3, name: "Lager - 330ml Bottle", brand: "Classic Brews", flavor: "Crisp", type: "Bottle" }
        ],
        equipment: {
            brewhouses: [
                { id: 'BH1', name: "Brewhouse 1", status: "Available" },
                { id: 'BH2', name: "Brewhouse 2", status: "Available" }
            ],
            fermentationTanks: Array.from({ length: 40 }, (_, i) => ({
                id: `FT${i + 1}`,
                name: `Fermentation Tank ${i + 1}`,
                status: "Empty", // Empty, CIP, Ready, Filling, Fermenting, Conditioning, Emptying
                capacity: 400 // Default capacity
            })),
            brightBeerTanks: Array.from({ length: 5 }, (_, i) => ({
                id: `BBT${i + 1}`,
                name: `Bright Beer Tank ${i + 1}`,
                status: "Empty",
                capacity: 500 // Default capacity
            })),
            filters: [
                { id: 'F1', name: "Filter 1", status: "Available" }
            ],
            packagingLines: [
                { id: 'PL1', name: "Can Line", type: "Can", status: "Available" },
                { id: 'PL2', name: "Keg Line", type: "Keg", status: "Available" },
                { id: 'PL3', name: "Bottle Line", type: "Bottle", status: "Available" }
            ]
        },
        processVariables: {
            1: { // Corresponds to SKU ID 1 (IPA)
                brewingTime: 8, // hours
                minFermentationDays: 14,
                conditioningTime: 5, // hours
                filteringTime: 6, // hours
                packagingRate: 3000, // Cans/hour
            },
            2: { // Corresponds to SKU ID 2 (Stout)
                brewingTime: 10,
                minFermentationDays: 21,
                conditioningTime: 8,
                filteringTime: 8,
                packagingRate: 50, // Kegs/hour
            },
            3: { // Corresponds to SKU ID 3 (Lager)
                brewingTime: 9,
                minFermentationDays: 18,
                conditioningTime: 6,
                filteringTime: 7,
                packagingRate: 2500, // Bottles/hour
            }
        },
        nonProductiveTimes: {
            cipTime: { brewhouse: 2, tank: 4, filter: 3, line: 2 }, // hours
            changeoverTime: { line: 3 } // hours
        }
    };

    // --- RENDER MASTER DATA ---
    function renderMasterData() {
        const content = document.getElementById('master-data-content');
        let html = '<h4>Product SKUs</h4><table><tr><th>ID</th><th>Name</th><th>Brand</th></tr>';
        masterData.productSKUs.forEach(sku => {
            html += `<tr><td>${sku.id}</td><td>${sku.name}</td><td>${sku.brand}</td></tr>`;
        });
        html += '</table>';

        html += '<h4>Tank Capacities</h4><table><tr><th>Tank</th><th>Capacity (L)</th></tr>';
        [...masterData.equipment.fermentationTanks, ...masterData.equipment.brightBeerTanks].forEach(tank => {
            html += `<tr><td>${tank.name}</td><td>${tank.capacity}</td></tr>`;
        });
        html += '</table>';

        content.innerHTML = html;
    }

    // --- RENDER RESOURCE STATUS ---
    function renderResourceStatus() {
        const content = document.getElementById('resource-management-content');
        let html = '<h4>Tank Status</h4><div class="tank-grid">';
        masterData.equipment.fermentationTanks.forEach(tank => {
            html += `<div class="tank ${tank.status.toLowerCase()}" title="${tank.name}: ${tank.status}">${tank.id}</div>`;
        });
        html += '</div>';
        // Add other resources
        html += '<h4>Other Resources</h4><table>';
        html += '<tr><th>Resource</th><th>Status</th></tr>';
        masterData.equipment.brewhouses.forEach(r => html += `<tr><td>${r.name}</td><td>${r.status}</td></tr>`);
        masterData.equipment.brightBeerTanks.forEach(r => html += `<tr><td>${r.name}</td><td>${r.status}</td></tr>`);
        masterData.equipment.filters.forEach(r => html += `<tr><td>${r.name}</td><td>${r.status}</td></tr>`);
        masterData.equipment.packagingLines.forEach(r => html += `<tr><td>${r.name}</td><td>${r.status}</td></tr>`);
        html += '</table>';
        content.innerHTML = html;
    }
    
    // --- DEMAND INTAKE ---
    const demandPlan = [];
    const skuSelect = document.getElementById('sku-select');
    const demandForm = document.getElementById('demand-form');
    const demandPlanTableBody = document.querySelector('#demand-plan-table tbody');

    function populateSKUSelect() {
        masterData.productSKUs.forEach(sku => {
            const option = document.createElement('option');
            option.value = sku.id;
            option.textContent = sku.name;
            skuSelect.appendChild(option);
        });
    }

    function renderDemandPlan() {
        demandPlanTableBody.innerHTML = '';
        demandPlan.forEach(item => {
            const sku = masterData.productSKUs.find(s => s.id === parseInt(item.skuId));
            const row = `<tr>
                <td>${sku.name}</td>
                <td>${item.quantity}</td>
                <td>${item.fulfilled}</td>
            </tr>`;
            demandPlanTableBody.innerHTML += row;
        });
    }

    demandForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const skuId = skuSelect.value;
        const quantity = parseInt(document.getElementById('quantity-input').value);

        const existingEntry = demandPlan.find(item => item.skuId === skuId);
        if (existingEntry) {
            existingEntry.quantity += quantity;
        } else {
            demandPlan.push({ skuId, quantity, fulfilled: 0 });
        }
        
        renderDemandPlan();
        demandForm.reset();
    });

    // --- SCHEDULING ENGINE ---
    const schedule = [];
    const generateScheduleBtn = document.getElementById('generate-schedule-btn');
    const scheduleTableBody = document.querySelector('#schedule-table tbody');

    // System state for simulation
    const systemState = {
        currentTime: 0, // in hours from start
        resourceSchedules: {} // key: resourceId, value: array of {start, end, task}
    };

    function initializeResourceSchedules() {
        const allResources = [
            ...masterData.equipment.brewhouses,
            ...masterData.equipment.fermentationTanks,
            ...masterData.equipment.brightBeerTanks,
            ...masterData.equipment.filters,
            ...masterData.equipment.packagingLines
        ];
        allResources.forEach(r => {
            systemState.resourceSchedules[r.id] = [];
        });
    }

    // Finds the earliest time a resource is free for a given duration
    function findNextAvailableSlot(resourceId, duration, earliestStartTime = 0) {
        const schedule = systemState.resourceSchedules[resourceId];
        let proposedStart = earliestStartTime;
        let slotFound = false;

        while (!slotFound) {
            const proposedEnd = proposedStart + duration;
            const conflict = schedule.find(event =>
                (proposedStart < event.end) && (proposedEnd > event.start)
            );

            if (!conflict) {
                slotFound = true;
            } else {
                proposedStart = conflict.end; // Jump to the end of the conflicting event
            }
        }
        return proposedStart;
    }

    function scheduleEvent(resourceId, start, end, task, skuName) {
        systemState.resourceSchedules[resourceId].push({ start, end, task });
        schedule.push({
            startTime: start,
            endTime: end,
            task: task,
            resource: resourceId,
            product: skuName
        });
    }

    function generateSchedule() {
        // Reset state
        schedule.length = 0;
        initializeResourceSchedules();

        // Optimization: Group by packaging type to minimize changeovers
        const sortedDemand = [...demandPlan].sort((a, b) => {
            const skuA = masterData.productSKUs.find(s => s.id === parseInt(a.skuId));
            const skuB = masterData.productSKUs.find(s => s.id === parseInt(b.skuId));
            return skuA.type.localeCompare(skuB.type);
        });

        let lastLine = null;
        let lastPackEndTime = 0;

        sortedDemand.forEach(item => {
            const sku = masterData.productSKUs.find(s => s.id === parseInt(item.skuId));
            const vars = masterData.processVariables[sku.id];
            const cip = masterData.nonProductiveTimes.cipTime;
            
            // Find an available tank first to determine batch size
            const availableTank = masterData.equipment.fermentationTanks.find(t => t.status === 'Empty' || t.status === 'Available');
            if (!availableTank) {
                postAlert(`SCHEDULING ERROR: No available Fermentation Tank to start production for ${sku.name}.`, 'alert-error');
                return; // Skip this demand item
            }

            const numBatches = Math.ceil(item.quantity / availableTank.capacity);
            let lastBatchEndTime = 0;

            for (let i = 0; i < numBatches; i++) {
                const batchName = `${sku.name} (Batch ${i + 1}/${numBatches})`;

                // 1. Brewing
                const brewhouse = masterData.equipment.brewhouses[0]; // Simple selection
                let brewStartTime = findNextAvailableSlot(brewhouse.id, vars.brewingTime, lastBatchEndTime);
                let brewEndTime = brewStartTime + vars.brewingTime;
                scheduleEvent(brewhouse.id, brewStartTime, brewEndTime, "Brewing", batchName);
                
                let brewCipStartTime = brewEndTime;
                let brewCipEndTime = brewCipStartTime + cip.brewhouse;
                scheduleEvent(brewhouse.id, brewCipStartTime, brewCipEndTime, "CIP", "N/A");

                // 2. Fermentation
                const tank = masterData.equipment.fermentationTanks.find(t => 
                    findNextAvailableSlot(t.id, vars.minFermentationDays * 24, brewEndTime) !== -1
                );

                if (tank) {
                    let fermStartTime = findNextAvailableSlot(tank.id, vars.minFermentationDays * 24, brewEndTime);
                    let fermEndTime = fermStartTime + (vars.minFermentationDays * 24);
                    scheduleEvent(tank.id, fermStartTime, fermEndTime, "Fermentation", batchName);

                    // 3. Filtering and moving to BBT
                    const filter = masterData.equipment.filters[0];
                    let filterStartTime = findNextAvailableSlot(filter.id, vars.filteringTime, fermEndTime);
                    let filterEndTime = filterStartTime + vars.filteringTime;
                    scheduleEvent(filter.id, filterStartTime, filterEndTime, "Filtering", batchName);
                    scheduleEvent(filter.id, filterEndTime, filterEndTime + cip.filter, "CIP", "N/A");

                    // FT is now free for CIP
                    scheduleEvent(tank.id, filterEndTime, filterEndTime + cip.tank, "CIP", "N/A");

                    // 4. Conditioning in BBT
                    const bbt = masterData.equipment.brightBeerTanks.find(b =>
                        findNextAvailableSlot(b.id, vars.conditioningTime, filterEndTime) !== -1
                    );
                    if (bbt) {
                        let condStartTime = findNextAvailableSlot(bbt.id, vars.conditioningTime, filterEndTime);
                        let condEndTime = condStartTime + vars.conditioningTime;
                        scheduleEvent(bbt.id, condStartTime, condEndTime, "Conditioning", batchName);

                    // 5. Packaging from BBT
                        const line = masterData.equipment.packagingLines.find(l => l.type === sku.type);
                        if (line) {
                            let packStartTime = findNextAvailableSlot(line.id, 0, condEndTime);

                            // Add changeover time if the line is different from the last one
                            if (lastLine && lastLine !== line.id) {
                                packStartTime = findNextAvailableSlot(line.id, cip.changeoverTime, lastPackEndTime);
                                scheduleEvent(line.id, lastPackEndTime, packStartTime, "Changeover", "N/A");
                            }
                            
                            const packagingTime = 8; // Simplified
                            let packEndTime = packStartTime + packagingTime;
                            scheduleEvent(line.id, packStartTime, packEndTime, "Packaging", batchName);
                            scheduleEvent(line.id, packEndTime, packEndTime + cip.line, "CIP", "N/A");
                            lastLine = line.id;
                            lastPackEndTime = packEndTime + cip.line;
                        }
                        // BBT is now free for CIP
                        scheduleEvent(bbt.id, condEndTime, condEndTime + cip.tank, "CIP", "N/A"); // Using tank CIP time for now
                    } else {
                        postAlert(`SCHEDULING ERROR: No available Bright Beer Tank for batch ${batchName}. Production for this item halted.`, 'alert-error');
                    }
                    lastBatchEndTime = brewEndTime; // Next brew can start after the previous one finishes
                } else {
                    postAlert(`SCHEDULING ERROR: No available Fermentation Tank for batch ${batchName}. Production for this item halted.`, 'alert-error');
                    break; // Stop scheduling for this SKU if no tank is found
                }
            }
        });

        renderSchedule();
        analyzeBottleneck();
    }

    function renderSchedule() {
        schedule.sort((a, b) => a.startTime - b.startTime);
        scheduleTableBody.innerHTML = '';

        const formatTime = (hours) => {
            if (hours > 36) {
                return `Day ${(hours / 24).toFixed(2)}`;
            }
            return `Hour ${hours.toFixed(2)}`;
        };

        schedule.forEach(event => {
            const row = `<tr>
                <td>${formatTime(event.startTime)}</td>
                <td>${formatTime(event.endTime)}</td>
                <td>${event.task}</td>
                <td>${event.resource}</td>
                <td>${event.product}</td>
            </tr>`;
            scheduleTableBody.innerHTML += row;
        });
    }

    generateScheduleBtn.addEventListener('click', generateSchedule);

    // --- EXECUTION & MONITORING ---
    const currentTimeDisplay = document.getElementById('current-time-display');
    const nextHourBtn = document.getElementById('next-hour-btn');
    const nextDayBtn = document.getElementById('next-day-btn');

    function advanceTime(hours) {
        const previousTime = systemState.currentTime;
        systemState.currentTime += hours;

        // Update resource statuses based on the schedule
        schedule.forEach(event => {
            const resource = findResource(event.resource);
            if (!resource) return;

            // Task starts within this time step
            if (event.startTime >= previousTime && event.startTime < systemState.currentTime) {
                resource.status = event.task;
            }
            // Task ends within this time step
            if (event.endTime >= previousTime && event.endTime < systemState.currentTime) {
                resource.status = 'Available'; // Simplified: becomes available immediately
            }
        });

        currentTimeDisplay.textContent = `Hour ${systemState.currentTime}`;
        renderResourceStatus();
        calculateAndRenderKPIs();
    }

    function findResource(resourceId) {
        for (const type in masterData.equipment) {
            const found = masterData.equipment[type].find(r => r.id === resourceId);
            if (found) return found;
        }
        return null;
    }

    nextHourBtn.addEventListener('click', () => advanceTime(1));
    nextDayBtn.addEventListener('click', () => advanceTime(24));

    // --- ANALYTICS & REPORTING ---
    const kpiContainer = document.getElementById('kpi-container');
    const bottleneckDisplay = document.getElementById('bottleneck-display');

    function analyzeBottleneck() {
        if (schedule.length === 0) {
            bottleneckDisplay.textContent = 'N/A';
            return;
        }

        const utilization = {};
        let maxUtilization = 0;
        let bottleneck = 'N/A';

        for (const type in masterData.equipment) {
            const resources = masterData.equipment[type];
            if (resources.length === 0) continue;

            let totalScheduledTime = 0;
            resources.forEach(resource => {
                systemState.resourceSchedules[resource.id].forEach(event => {
                    if (event.task !== 'CIP' && event.task !== 'Changeover') {
                        totalScheduledTime += (event.endTime - event.start);
                    }
                });
            });

            const avgUtilization = totalScheduledTime / resources.length;
            utilization[type] = avgUtilization;

            if (avgUtilization > maxUtilization) {
                maxUtilization = avgUtilization;
                bottleneck = type;
            }
        }
        bottleneckDisplay.textContent = bottleneck;
    }

    function calculateAndRenderKPIs() {
        let html = '<table><tr><th>Resource Type</th><th>Utilization</th></tr>';
        const totalTime = systemState.currentTime > 0 ? systemState.currentTime : 1; // Avoid division by zero

        // Brewhouse Utilization
        let brewhouseTime = 0;
        masterData.equipment.brewhouses.forEach(bh => {
            systemState.resourceSchedules[bh.id].forEach(event => {
                if (event.task !== 'CIP' && event.endTime <= totalTime) {
                    brewhouseTime += (event.endTime - event.start);
                }
            });
        });
        const bhUtilization = ((brewhouseTime / masterData.equipment.brewhouses.length) / totalTime) * 100;
        html += `<tr><td>Brewhouses</td><td>${bhUtilization.toFixed(1)}%</td></tr>`;

        // Tank Utilization (simplified: days occupied)
        let tankDays = 0;
        masterData.equipment.fermentationTanks.forEach(tank => {
             systemState.resourceSchedules[tank.id].forEach(event => {
                if (event.endTime <= totalTime) {
                    tankDays += (event.endTime - event.start) / 24;
                }
            });
        });
        const totalTankDays = masterData.equipment.fermentationTanks.length * (totalTime / 24);
        const tankUtilization = (tankDays / totalTankDays) * 100;
        html += `<tr><td>Fermentation Tanks</td><td>${tankUtilization.toFixed(1)}%</td></tr>`;


        html += '</table>';
        kpiContainer.innerHTML = html;
        analyzeBottleneck();
    }


    // --- SCENARIO PLANNER ---
    const breakdownSelect = document.getElementById('breakdown-select');
    const breakdownBtn = document.getElementById('breakdown-btn');

    function populateBreakdownSelect() {
        breakdownSelect.innerHTML = '';
        const allResources = [
            ...masterData.equipment.brewhouses,
            ...masterData.equipment.fermentationTanks,
            ...masterData.equipment.brightBeerTanks,
            ...masterData.equipment.filters,
            ...masterData.equipment.packagingLines
        ];
        allResources.forEach(r => {
            const option = document.createElement('option');
            option.value = r.id;
            option.textContent = r.name;
            breakdownSelect.appendChild(option);
        });
    }

    function simulateBreakdown() {
        const resourceId = breakdownSelect.value;
        const resource = findResource(resourceId);
        if (!resource) return;

        resource.status = 'Maintenance';
        
        const maintenanceStart = systemState.currentTime;
        const maintenanceEnd = maintenanceStart + 24;
        scheduleEvent(resourceId, maintenanceStart, maintenanceEnd, "Maintenance", "N/A");

        postAlert(`SCENARIO: ${resource.name} is now under maintenance for 24 hours. Regenerating schedule.`, 'alert-warning');

        const currentDemand = [...demandPlan];
        demandPlan.length = 0;
        
        // Clear future events from the main schedule
        const futureEvents = schedule.filter(e => e.startTime >= systemState.currentTime);
        futureEvents.forEach(e => {
            const index = schedule.indexOf(e);
            if (index > -1) schedule.splice(index, 1);
        });
        
        // Clear resource schedules
        initializeResourceSchedules();
        schedule.forEach(e => systemState.resourceSchedules[e.resource].push(e));


        currentDemand.forEach(d => demandPlan.push(d));
        generateSchedule(); // This needs to be smarter, but for now it regenerates
        renderDemandPlan();
        renderResourceStatus();
    }

    breakdownBtn.addEventListener('click', simulateBreakdown);

    // --- ALERTS ---
    const alertsContent = document.getElementById('alerts-content');
    function postAlert(message, type = 'alert-info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert ${type}`;
        alertDiv.textContent = `[Hour ${systemState.currentTime.toFixed(0)}] ${message}`;
        alertsContent.insertBefore(alertDiv, alertsContent.firstChild);
    }


    // --- CAPACITY FORM ---
    const capacityForm = document.getElementById('capacity-form');
    const tankSelect = document.getElementById('tank-select');
    const capacityInput = document.getElementById('capacity-input');

    function populateTankSelect() {
        tankSelect.innerHTML = '';
        const allTanks = [...masterData.equipment.fermentationTanks, ...masterData.equipment.brightBeerTanks];
        allTanks.forEach(tank => {
            const option = document.createElement('option');
            option.value = tank.id;
            option.textContent = tank.name;
            tankSelect.appendChild(option);
        });
    }

    capacityForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const tankId = tankSelect.value;
        const newCapacity = parseInt(capacityInput.value);
        if (isNaN(newCapacity) || newCapacity <= 0) {
            postAlert('Invalid capacity value.', 'alert-error');
            return;
        }

        const tank = findResource(tankId);
        if (tank) {
            tank.capacity = newCapacity;
            postAlert(`Capacity for ${tank.name} updated to ${newCapacity}L.`, 'alert-info');
            renderMasterData();
            capacityForm.reset();
        }
    });


    // --- INITIAL RENDER ---
    renderMasterData();
    renderResourceStatus();
    populateSKUSelect();
    renderDemandPlan();
    initializeResourceSchedules();
    calculateAndRenderKPIs();
    populateBreakdownSelect();
    populateTankSelect();
    analyzeBottleneck();
});
