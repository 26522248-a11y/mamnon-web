// Design tokens - Mầm non Mint (designer)
module.exports = {
  theme: { extend: {
    colors: {
      mint:  {50:'#ECFBF6',100:'#D2F5E9',300:'#7FDDBF',500:'#2EBF91',600:'#22A07A',700:'#1B7F62'},
      peach: {50:'#FFF4EC',100:'#FFE3CF',300:'#FFB98A',500:'#FF8A4C',600:'#E8702F'},
      sun:   {100:'#FFF6CC',500:'#FFCB2F'},
      sky:   {100:'#E3F1FF',500:'#4DA3FF'},
      rose:  {100:'#FFE4E8',500:'#F2546B',600:'#D93B53'},
      ink:   {900:'#1F2A37',700:'#3B4A5C',500:'#6B7A8C',300:'#B8C2CE',100:'#EEF1F5'},
      cream: '#FFFCF7'
    },
    fontFamily: { sans: ['"Be Vietnam Pro"','system-ui','sans-serif'] },
    borderRadius: { xl:'14px', '2xl':'20px', '3xl':'28px' },
    boxShadow: { card:'0 4px 18px rgba(31,42,55,.06)', pop:'0 10px 30px rgba(46,191,145,.25)' }
  }}
};
// Trạng thái điểm danh: Có mặt = mint-500, Vắng = rose-500, Đi muộn = sun-500, Chưa điểm = ink-300
// Nút: h-12 (mobile 52px), rounded-xl, chữ 15px/600. Ô chạm tối thiểu 48px.
// Font: Be Vietnam Pro 400/500/600/700; H1 28, H2 22, H3 18, body 15, caption 13.
