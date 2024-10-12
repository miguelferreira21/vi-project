// Centralized update mechanism using publish-subscribe pattern
const LinkedCharts = {
  subscribers: {},

  subscribe: function(chart, updateFunction) {
    if (!this.subscribers[chart]) {
      this.subscribers[chart] = [];
    }
    this.subscribers[chart].push(updateFunction);
  },

  unsubscribe: function(chart, updateFunction) {
    if (this.subscribers[chart]) {
      this.subscribers[chart] = this.subscribers[chart].filter(func => func !== updateFunction);
    }
  },

  publish: function(chart, data) {
    if (this.subscribers[chart]) {
      this.subscribers[chart].forEach(updateFunction => updateFunction(data));
    }
  },

  updateAll: function(data) {
    for (let chart in this.subscribers) {
      this.publish(chart, data);
    }
  }
};

// Data binding mechanism
function bindData(data) {
  // Implement data binding logic here
  // For now, we'll just update all charts
  LinkedCharts.updateAll(data);
}
