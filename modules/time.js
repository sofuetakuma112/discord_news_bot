exports.getStringFromDate = (date) => {
  const year_str = date.getFullYear();
  //月だけ+1すること
  let month_str = 1 + date.getMonth();
  let day_str = date.getDate();

  month_str = ('0' + month_str).slice(-2);
  day_str = ('0' + day_str).slice(-2);

  format_str = 'YYYY-MM-DD';
  format_str = format_str.replace(/YYYY/g, year_str);
  format_str = format_str.replace(/MM/g, month_str);
  format_str = format_str.replace(/DD/g, day_str);

  return format_str;
}