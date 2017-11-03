var parser = require('../../src/parser/journal-parser');
var journal = require('../../src/journal');
var balancer = require('../../src/balance');
var c3 = require('c3');
var Big = require('big.js');
var sampleGenerator = require('../../generator/generator.util');
var accountNameHelper = require('./util/account-name-helper');

var Vue = require('vue');
require('./components/accounts.js');
require('./components/account-filter.js');

var app = new Vue({
  el: '#app',
  data: {
    filter: 'Expenses',
    accountTree: {}
  },
  methods: {
    accountTreeProp: function(){
      return this.accountTree;
    },
    handleFiles : function(e) {
        var files = e.currentTarget.files;
        var reader = new FileReader();
        var self = this;

        reader.onload = function(e) {
            var text = reader.result
            self.createJournal(text);
            self.calculateBalance();
            self.createChart();
        }
        reader.onerror = function(err) {
            console.log(err, err.loaded, err.loaded === 0);
            button.removeAttribute("disabled");
        }
        reader.readAsText(files[0]);
    },

    createJournal: function(text){
        journal.reset();

        parser.reset(text)
        var chunk;
        try{
          while((chunk = parser.next()) != null){
            journal.add(chunk);
          }
        }catch(e){
          console.log(e);
          console.log('Failing on line ' + JSON.stringify(e.chunk));
        }
    },

    transactions: function(){
      return journal.transactions(t =>
        t.type == 'transaction' && t.date.month == 10
        && t.posting[0].amount != null
        && accountNameHelper.encodeAccountName(t.posting[0].account).toLowerCase().indexOf(this.filter.toLowerCase()) >= 0
      )
    },

    calculateBalance: function(){
        var balance = "";

        let self = this;
        self.accounts = [];

        var b = balancer.balance(journal, t => t.date.month == 10);

        var b2 = accountNameHelper.filter(this.filter, b).sort((a, b) =>
          accountNameHelper.encodeAccountName(a.account)
            .localeCompare(accountNameHelper.encodeAccountName(b.account))
        );

        var offset = 18;

        this.accountTree = {};
        let tree = {}
        b2.forEach(a =>{
          let branchLevel = tree;
          a.account.forEach(n => {
            var nextLevel = branchLevel.accounts == null ? null : branchLevel.accounts[n];
            if(nextLevel == null)
            {
              var nextLevel = {name: n};
              if(branchLevel.accounts == null)
                branchLevel.accounts = {};
              branchLevel.accounts[n] = nextLevel;
            }
            branchLevel = nextLevel;
          });
          branchLevel.balance = parseFloat(a.balance.toFixed(2));
          branchLevel.currency = a.currency;
        });

        this.accountTree = tree.accounts;
    },
    generateJournal: function(){
      var text = '';
      for(let i = 1; i <= 30; i++){
        text += sampleGenerator.transactionsDay(2017, 10, i);
      }
      return text;
    },

    getMonthlyBalance: function(filter, month){
        var b = balancer.balance(journal, t => t.date.month == month);
        var b2 = accountNameHelper.filter(filter, b);
        if(b2.length > 0)
        {
          var a = b2[0];
          return Math.abs(parseFloat(a.balance.toFixed(2)));
        }
        else
        {
          return (0.00);
        }
    },

    createChart: function(){
      let dataExpense = ['Expense'];
      let dataIncome = ['Income'];
      for(let i = 1; i <= 12; ++i){
        dataExpense.push(this.getMonthlyBalance('Expense', i));
        dataIncome.push(this.getMonthlyBalance('Income', i));
      }

      var chart = c3.generate({
          bindto: '#chart',
          data: {
              columns: [
                  dataExpense,
                  dataIncome
              ],
              labels: true,
              type: 'bar'
          },
          bar: {
              width: {
                  ratio: 0.9
              }
          }
      });
    }
  },

  beforeMount: function(){
      var text = this.generateJournal();
      this.createJournal(text);
      this.calculateBalance();
  },
})

