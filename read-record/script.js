// 阅读记录应用
class ReadingRecordApp {
    constructor() {
        this.records = JSON.parse(localStorage.getItem('readingRecords')) || [];
        this.init();
    }
    
    init() {
        // 绑定表单提交事件
        document.getElementById('book-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addRecord();
        });
        
        // 绑定编辑表单提交事件
        document.getElementById('edit-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEdit();
        });
        
        // 绑定关闭模态框事件
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });
        
        // 点击模态框外部关闭
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('edit-modal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
        
        // 渲染记录列表
        this.renderRecords();
    }
    
    addRecord() {
        const bookName = document.getElementById('book-name').value;
        const category = document.getElementById('book-category').value;
        const rating = document.querySelector('input[name="rating"]:checked').value;
        
        const record = {
            id: Date.now(),
            bookName,
            category,
            rating: parseInt(rating),
            date: new Date().toLocaleDateString()
        };
        
        this.records.push(record);
        this.saveToLocalStorage();
        this.renderRecords();
        
        // 重置表单
        document.getElementById('book-form').reset();
    }
    
    deleteRecord(id) {
        this.records = this.records.filter(record => record.id !== id);
        this.saveToLocalStorage();
        this.renderRecords();
    }
    
    editRecord(id) {
        const record = this.records.find(record => record.id === id);
        if (!record) return;
        
        // 填充编辑表单
        document.getElementById('edit-id').value = record.id;
        document.getElementById('edit-book-name').value = record.bookName;
        document.getElementById('edit-book-category').value = record.category;
        
        // 选中对应的评分
        document.querySelector(`input[name="edit-rating"][value="${record.rating}"]`).checked = true;
        
        // 显示模态框
        document.getElementById('edit-modal').style.display = 'block';
    }
    
    saveEdit() {
        const id = parseInt(document.getElementById('edit-id').value);
        const bookName = document.getElementById('edit-book-name').value;
        const category = document.getElementById('edit-book-category').value;
        const rating = document.querySelector('input[name="edit-rating"]:checked').value;
        
        const recordIndex = this.records.findIndex(record => record.id === id);
        if (recordIndex === -1) return;
        
        // 更新记录
        this.records[recordIndex] = {
            ...this.records[recordIndex],
            bookName,
            category,
            rating: parseInt(rating)
        };
        
        this.saveToLocalStorage();
        this.renderRecords();
        this.closeModal();
    }
    
    closeModal() {
        document.getElementById('edit-modal').style.display = 'none';
    }
    
    saveToLocalStorage() {
        localStorage.setItem('readingRecords', JSON.stringify(this.records));
    }
    
    renderRecords() {
        const recordsList = document.getElementById('records-list');
        
        if (this.records.length === 0) {
            recordsList.innerHTML = '<p class="no-records">暂无阅读记录</p>';
            return;
        }
        
        recordsList.innerHTML = this.records.map(record => {
            // 生成评分星星
            const stars = '★'.repeat(record.rating) + '☆'.repeat(5 - record.rating);
            
            return `
                <div class="record-item">
                    <h3>${record.bookName}</h3>
                    <span class="category">${record.category}</span>
                    <div class="rating-display">${stars}</div>
                    <small>记录日期: ${record.date}</small>
                    <button class="edit-btn" onclick="app.editRecord(${record.id})">编辑</button>
                    <button class="delete-btn" onclick="app.deleteRecord(${record.id})">删除</button>
                </div>
            `;
        }).join('');
    }
}

// 初始化应用
const app = new ReadingRecordApp();