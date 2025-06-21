class SimpleFlowBuilder {
    constructor() {
        this.steps = [];
        this.stepCounter = 0;
        this.init();
    }

    init() {
        this.bindEvents();
        this.addInitialStep();
    }

    bindEvents() {
        document.getElementById('addStep').addEventListener('click', () => this.addStep());
        document.getElementById('runWorkflow').addEventListener('click', () => this.runWorkflow());
        document.getElementById('clearWorkflow').addEventListener('click', () => this.clearWorkflow());
    }

    addInitialStep() {
        this.addStep("Type your first automation step here...\nExample: 'Send an email to john@example.com with subject Hello World'");
    }

    addStep(placeholder = "Describe what you want to do in simple English...") {
        this.stepCounter++;
        const stepId = `step-${this.stepCounter}`;
        
        const stepHtml = `
            <div class="step-item" data-step-id="${stepId}">
                <div class="step-header">
                    <div class="step-number">${this.stepCounter}</div>
                    <div class="step-controls">
                        <button class="btn-primary btn-small btn-test" onclick="simpleFlow.testStep('${stepId}')">
                            Test Step
                        </button>
                        <button class="btn-danger btn-small btn-remove" onclick="simpleFlow.removeStep('${stepId}')">
                            Remove
                        </button>
                    </div>
                </div>
                <textarea 
                    class="step-input" 
                    placeholder="${placeholder}"
                    data-step-id="${stepId}"
                ></textarea>
                <div class="step-result" id="result-${stepId}"></div>
            </div>
        `;

        document.getElementById('workflowSteps').insertAdjacentHTML('beforeend', stepHtml);
        
        const newInput = document.querySelector(`[data-step-id="${stepId}"].step-input`);
        newInput.focus();
    }

    removeStep(stepId) {
        const stepElement = document.querySelector(`[data-step-id="${stepId}"].step-item`);
        if (stepElement) {
            stepElement.remove();
            this.renumberSteps();
        }
    }

    renumberSteps() {
        const steps = document.querySelectorAll('.step-item');
        steps.forEach((step, index) => {
            const stepNumber = step.querySelector('.step-number');
            stepNumber.textContent = index + 1;
        });
    }

    async testStep(stepId) {
        const input = document.querySelector(`[data-step-id="${stepId}"].step-input`);
        const resultDiv = document.getElementById(`result-${stepId}`);
        const stepText = input.value.trim();

        if (!stepText) {
            this.showResult(resultDiv, '⚠️ Please enter a step description first', 'warning');
            return;
        }

        this.showResult(resultDiv, '⏳ Processing step...', 'loading');

        try {
            const response = await fetch('/api/process-step', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    stepText: stepText,
                    stepNumber: this.getStepNumber(stepId)
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.showResult(resultDiv, result.result, 'success');
            } else {
                this.showResult(resultDiv, `❌ Error: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showResult(resultDiv, `❌ Connection error: ${error.message}`, 'error');
        }
    }

    async runWorkflow() {
        const steps = document.querySelectorAll('.step-input');
        const resultsDiv = document.getElementById('results');
        
        if (steps.length === 0) {
            resultsDiv.innerHTML = '⚠️ No steps to run. Add some steps first!';
            return;
        }

        resultsDiv.innerHTML = '🚀 Running your automation...\n\n';

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const stepText = step.value.trim();
            
            if (!stepText) {
                resultsDiv.innerHTML += `Step ${i + 1}: ⚠️ Skipped (empty)\n`;
                continue;
            }

            resultsDiv.innerHTML += `Step ${i + 1}: Processing "${stepText}"...\n`;

            try {
                const response = await fetch('/api/process-step', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        stepText: stepText,
                        stepNumber: i + 1
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    resultsDiv.innerHTML += `Step ${i + 1}: ✅ ${result.result}\n\n`;
                } else {
                    resultsDiv.innerHTML += `Step ${i + 1}: ❌ Error: ${result.error}\n\n`;
                }
            } catch (error) {
                resultsDiv.innerHTML += `Step ${i + 1}: ❌ Connection error: ${error.message}\n\n`;
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        resultsDiv.innerHTML += '🎉 Automation completed!';
    }

    clearWorkflow() {
        if (confirm('Are you sure you want to clear all steps?')) {
            document.getElementById('workflowSteps').innerHTML = '';
            document.getElementById('results').innerHTML = '<p class="placeholder">Results will show here when you run your automation...</p>';
            this.stepCounter = 0;
            this.addInitialStep();
        }
    }

    showResult(resultDiv, message, type) {
        resultDiv.innerHTML = message;
        resultDiv.className = `step-result show ${type}`;
        
        if (type !== 'error') {
            setTimeout(() => {
                resultDiv.classList.remove('show');
            }, 5000);
        }
    }

    getStepNumber(stepId) {
        const stepElement = document.querySelector(`[data-step-id="${stepId}"].step-item`);
        const stepNumber = stepElement.querySelector('.step-number');
        return parseInt(stepNumber.textContent);
    }
}

let simpleFlow;
document.addEventListener('DOMContentLoaded', () => {
    simpleFlow = new SimpleFlowBuilder();
});
