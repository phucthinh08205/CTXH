
"use strict";

// =============================================
// 1. CONFIGURATION
// =============================================

const DATA_FILE_PATH = "res/formatted_data.json";

let database = [];
let currentMatchResults = [];
let isAscendingOrder = true;
let isLoading = false;


// =============================================
// 2. DOM ELEMENTS
// =============================================

const elements = {
    form: document.getElementById("searchForm"),

    mssv: document.getElementById("mssvInput"),
    name: document.getElementById("nameInput"),
    className: document.getElementById("classInput"),

    searchBtn: document.getElementById("searchBtn"),
    clearBtn: document.getElementById("clearBtn"),

    alertBox: document.getElementById("alertBox"),
    resultSection: document.getElementById("resultSection"),

    resultBody: document.getElementById("resultBody"),

    studentName: document.getElementById("studentName"),
    studentMssv: document.getElementById("studentMssv"),
    studentClass: document.getElementById("studentClass"),
    studentAvatar: document.getElementById("studentAvatar"),

    totalDays: document.getElementById("totalDays"),
    totalActivities: document.getElementById("totalActivities"),
    totalDates: document.getElementById("totalDates"),

    resultCount: document.getElementById("resultCount"),
    resultDescription: document.getElementById("resultDescription"),

    tableFooterText: document.getElementById("tableFooterText"),
    sortDateBtn: document.getElementById("sortDateBtn")
};


// =============================================
// 3. SECURITY - ESCAPE HTML
// =============================================

function esc(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


// =============================================
// 4. ALERT SYSTEM
// =============================================

function showAlert(message, type = "error") {

    if (!elements.alertBox) return;

    elements.alertBox.textContent = message;

    elements.alertBox.className =
        type === "success"
            ? "alert alert-success"
            : "alert alert-error";

    elements.alertBox.hidden = false;
}


function clearAlert() {

    if (!elements.alertBox) return;

    elements.alertBox.textContent = "";
    elements.alertBox.className = "alert";
    elements.alertBox.hidden = true;
}


// =============================================
// 5. LOADING BUTTON
// =============================================

function setLoading(status) {

    isLoading = status;

    if (!elements.searchBtn) return;

    const text = elements.searchBtn.querySelector(".btn-text");

    elements.searchBtn.disabled = status;

    if (text) {
        text.textContent = status
            ? "Đang tra cứu..."
            : "Tra cứu ngay";
    }
}


// =============================================
// 6. LOAD JSON DATA
// =============================================

async function loadDatabase() {

    try {

        const response = await fetch(DATA_FILE_PATH, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error(
                "Dữ liệu JSON không đúng định dạng Array."
            );
        }

        database = data;

        console.log(
            `Đã tải thành công ${database.length} bản ghi.`
        );

        return true;

    } catch (error) {

        console.error("Database Error:", error);

        showAlert(
            "Không thể tải dữ liệu. Vui lòng kiểm tra file " +
            DATA_FILE_PATH + " hoặc kết nối máy chủ."
        );

        return false;
    }
}


// =============================================
// 7. DATE UTILITIES
// Hỗ trợ DD/MM/YYYY
// =============================================

function parseSingleDate(dateStr) {

    if (!dateStr || typeof dateStr !== "string") {
        return null;
    }

    const value = dateStr.trim();

    const match = value.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(year, month - 1, day);

    // Kiểm tra ngày tháng hợp lệ
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}


// =============================================
// 8. PARSE SORT DATE
// Ưu tiên ngay_bat_dau từ Python JSON
// =============================================

function parseSortDate(item) {

    if (!item) {
        return new Date(0);
    }

    // Ưu tiên ngày bắt đầu đã được Python phân tích
    const startDate = parseSingleDate(item.ngay_bat_dau);

    if (startDate) {
        return startDate;
    }

    // Nếu không có ngay_bat_dau thì thử đọc ngay_thuc_hien
    const displayDate = String(
        item.ngay_thuc_hien || ""
    ).trim();

    // Ngày đơn
    const singleDate = parseSingleDate(displayDate);

    if (singleDate) {
        return singleDate;
    }

    // Khoảng ngày: 01/09/2023 - 30/09/2023
    const rangeMatch = displayDate.match(
        /^(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})$/
    );

    if (rangeMatch) {
        return parseSingleDate(rangeMatch[1]) || new Date(0);
    }

    // Nhiều ngày: 14/04/2024, 21/04/2024
    const multipleMatch = displayDate.match(
        /^(\d{1,2}\/\d{1,2}\/\d{4}),/
    );

    if (multipleMatch) {
        return parseSingleDate(multipleMatch[1]) || new Date(0);
    }

    return new Date(0);
}


// =============================================
// 9. UPDATE SORT BUTTON
// =============================================

function updateSortButtonLabel() {

    if (!elements.sortDateBtn) return;

    if (isAscendingOrder) {

        elements.sortDateBtn.innerHTML =
            "<span>↑</span> Cũ nhất trước";

    } else {

        elements.sortDateBtn.innerHTML =
            "<span>↓</span> Mới nhất trước";
    }
}


// =============================================
// 10. SEARCH DATA
// =============================================

async function processData() {

    if (isLoading) return;

    clearAlert();

    const mssvVal = elements.mssv.value
        .trim()
        .toUpperCase();

    const nameVal = elements.name.value
        .trim()
        .toLowerCase();

    const classVal = elements.className.value
        .trim()
        .toUpperCase();

    // Kiểm tra MSSV
    if (!mssvVal) {

        showAlert(
            "Vui lòng nhập Mã số sinh viên (MSSV)!"
        );

        elements.mssv.focus();
        return;
    }

    setLoading(true);

    try {

        // Tải dữ liệu nếu chưa có
        if (database.length === 0) {

            const loaded = await loadDatabase();

            if (!loaded) return;
        }

        // Lọc dữ liệu
        const filteredData = database.filter(item => {

            const itemMSSV = String(
                item.mssv || ""
            ).trim().toUpperCase();

            const itemName = String(
                item.ho_ten || ""
            ).trim().toLowerCase();

            const itemClass = String(
                item.ma_lop || ""
            ).trim().toUpperCase();

            // MSSV bắt buộc
            if (itemMSSV !== mssvVal) {
                return false;
            }

            // Tên không bắt buộc
            if (
                nameVal &&
                !itemName.includes(nameVal)
            ) {
                return false;
            }

            // Lớp không bắt buộc
            if (
                classVal &&
                itemClass !== classVal
            ) {
                return false;
            }

            return true;
        });

        // Không tìm thấy dữ liệu
        if (filteredData.length === 0) {

            elements.resultSection.hidden = true;

            showAlert(
                "Không tìm thấy hoạt động phù hợp với MSSV: " +
                mssvVal
            );

            return;
        }

        // Chuẩn hóa dữ liệu
        currentMatchResults = filteredData.map(item => {

            const dateStr = String(
                item.ngay_thuc_hien || "Chưa xác định"
            ).trim();

            const rawDays = Number(
                item.so_ngay_cong
            );

            return {

                mssv: item.mssv || "N/A",

                name: item.ho_ten || "Chưa rõ họ tên",

                studentClass: item.ma_lop || "N/A",

                activity:
                    item.ten_hoat_dong ||
                    "Tham gia hoạt động CTXH",

                // Ngày hiển thị
                date: dateStr,

                // Ngày dùng để sắp xếp
                sortDate: parseSortDate(item),

                // Ngày bắt đầu và kết thúc
                startDate: item.ngay_bat_dau || null,
                endDate: item.ngay_ket_thuc || null,

                // Thông tin loại thời gian
                dateType: item.loai_thoi_gian || null,

                datePrecision: item.do_chinh_xac || null,

                rawTime: item.thoi_gian_goc || null,

                // Số ngày công
                days: Number.isFinite(rawDays)
                    ? rawDays
                    : 0,

                // Nguồn dữ liệu
                activitySource:
                    item.nguon_ten_hoat_dong || "unknown",

                dateSource:
                    item.nguon_ngay_thuc_hien || "unknown",

                // File PDF gốc
                sourceFile:
                    item.ten_file_nguon || null
            };
        });

        // Mặc định: Cũ nhất trước
        isAscendingOrder = true;

        sortResults();

        updateSortButtonLabel();

        renderResults();

        elements.resultSection.hidden = false;

        // Cuộn đến kết quả
        elements.resultSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {

        console.error("Search Error:", error);

        showAlert(
            "Đã xảy ra lỗi trong quá trình tra cứu dữ liệu."
        );

    } finally {

        setLoading(false);
    }
}


// =============================================
// 11. SORT RESULTS
// =============================================

function sortResults() {

    currentMatchResults.sort((a, b) => {

        return isAscendingOrder
            ? a.sortDate - b.sortDate
            : b.sortDate - a.sortDate;
    });
}


// =============================================
// 12. RENDER STUDENT INFORMATION
// =============================================

function renderStudentInfo() {

    if (currentMatchResults.length === 0) return;

    const student = currentMatchResults[0];

    elements.studentName.textContent = student.name;

    elements.studentMssv.textContent =
        "MSSV: " + student.mssv;

    elements.studentClass.textContent =
        "Lớp: " + student.studentClass;

    // Tạo chữ viết tắt từ tên
    const initials = student.name
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map(word => word.charAt(0))
        .join("")
        .toUpperCase();

    elements.studentAvatar.textContent =
        initials || "SV";
}


// =============================================
// 13. RENDER STATISTICS
// =============================================

function renderStatistics() {

    // Tổng ngày công
    const sumDays = currentMatchResults.reduce(
        (sum, item) => sum + item.days,
        0
    );

    // Đếm ngày hoặc khoảng thời gian khác nhau
    const uniqueDates = new Set(
        currentMatchResults
            .filter(item => {
                return (
                    item.date &&
                    item.date !== "Chưa xác định" &&
                    item.date !== "N/A" &&
                    !item.date.toUpperCase().startsWith("CTXH")
                );
            })
            .map(item => item.date)
    );

    elements.totalDays.textContent =
        (Math.round(sumDays * 100) / 100)
            .toLocaleString("vi-VN");

    elements.totalActivities.textContent =
        currentMatchResults.length.toLocaleString("vi-VN");

    elements.totalDates.textContent =
        uniqueDates.size.toLocaleString("vi-VN");
}


// =============================================
// 14. RENDER TABLE
// =============================================

function renderTableData() {

    const tbody = elements.resultBody;

    if (!tbody) return;

    tbody.replaceChildren();

    currentMatchResults.forEach((item, index) => {

        const row = document.createElement("tr");

        // Xử lý ngày không xác định
        const isCTXH = item.date
            .trim()
            .toUpperCase()
            .startsWith("CTXH");

        const displayDate = isCTXH
            ? "Không có"
            : item.date;

        const days = Number.isFinite(item.days)
            ? item.days.toLocaleString("vi-VN")
            : "0";

        // Tạo nội dung bảng
        row.innerHTML = `
            <td>${index + 1}</td>

            <td class="cell-mssv">
                ${esc(item.mssv)}
            </td>

            <td class="cell-name">
                ${esc(item.name)}
            </td>

            <td class="cell-class">
                ${esc(item.studentClass)}
            </td>

            <td class="activity-name cell-activity"
                title="${esc(item.sourceFile || "")}">
                ${esc(item.activity)}
            </td>

            <td class="date-value"
                title="${esc(item.rawTime || "")}">
                ${esc(displayDate)}
            </td>

            <td class="days-value">
                +${days}
            </td>
        `;

        tbody.appendChild(row);
    });

    if (elements.tableFooterText) {
        elements.tableFooterText.textContent =
            `Đang hiển thị ${currentMatchResults.length} hoạt động`;
    }
}


// =============================================
// 15. RENDER COMPLETE RESULTS
// =============================================

function renderResults() {

    if (currentMatchResults.length === 0) return;

    const student = currentMatchResults[0];

    renderStudentInfo();

    renderStatistics();

    renderTableData();

    // Tiêu đề kết quả
    elements.resultCount.textContent =
        `${currentMatchResults.length} hoạt động`;

    elements.resultDescription.textContent =
        `Tìm thấy ${currentMatchResults.length} hoạt động của sinh viên ${student.name}.`;
}


// =============================================
// 16. TOGGLE SORT
// =============================================

function toggleSortByDate() {

    if (currentMatchResults.length === 0) return;

    isAscendingOrder = !isAscendingOrder;

    sortResults();

    updateSortButtonLabel();

    renderTableData();
}


// =============================================
// 17. CLEAR FORM
// =============================================

function clearForm() {

    if (elements.form) {
        elements.form.reset();
    }

    currentMatchResults = [];

    if (elements.resultBody) {
        elements.resultBody.replaceChildren();
    }

    if (elements.resultSection) {
        elements.resultSection.hidden = true;
    }

    clearAlert();

    isAscendingOrder = true;

    updateSortButtonLabel();

    if (elements.mssv) {
        elements.mssv.focus();
    }
}


// =============================================
// 18. EVENT LISTENERS
// =============================================

// Nút tra cứu thông qua form
if (elements.form) {

    elements.form.addEventListener(
        "submit",
        function(event) {

            event.preventDefault();

            processData();
        }
    );
}


// Nút xóa
if (elements.clearBtn) {

    elements.clearBtn.addEventListener(
        "click",
        clearForm
    );
}


// Nút sắp xếp
if (elements.sortDateBtn) {

    elements.sortDateBtn.addEventListener(
        "click",
        toggleSortByDate
    );
}


// =============================================
// 19. INITIALIZATION
// =============================================

updateSortButtonLabel();
