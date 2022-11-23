/*
*  Frappe Better Attach Control © 2022
*  Author:  Ameen Ahmed
*  Company: Level Up Marketing & Software Development Services
*  Licence: Please refer to LICENSE file
*/


import {
    deepClone,
    isArray,
    isPlainObject,
    each,
    clear,
    parseJson,
    toJson,
    toArray,
    fn,
    formatSize
} from './../../utils';
import {
    get_icon_class,
    to_images_list
} from './../../filetypes';


frappe.ui.form.ControlAttach = frappe.ui.form.ControlAttach.extend({
    make: function() {
        this._super();
        this._parse_options();
    },
    make_input: function() {
        this._parse_options();
        
        var me = this;
		this.$input = $('<button class="btn btn-default btn-sm btn-attach">')
			.html(__("Attach"))
			.prependTo(me.input_area)
			.on('click', function() { me.on_attach_click(); });
		
		this.$value = $(`
		    <div class="attached-file flex justify-between align-center">
				<div class="ellipsis">
					<i class="fa fa-paperclip"></i>
					<a class="attached-file-link" target="_blank"></a>
				</div>
				<a class="btn btn-xs btn-default clear-file">${__('Clear')}</a>
			</div>
		`)
		    .prependTo(this.input_area)
		    .toggle(false);
		
		this._setup_display();
		
		this.input = this.$input.get(0);
		this.set_input_attributes();
		this.has_input = true;

		this.$value.find(".clear-file").on("click", function() {
			me.clear_attachment();
		});
	},
	clear_attachment: function() {
	    if (!this.frm) {
            this.dataurl = null;
            this.fileobj = null;
            this.set_input(null);
            this.refresh();
            return;
        }
        
		var callback = fn(function() {
            this.parse_validate_and_set_in_model(null);
            this.refresh();
            cint(this.frm.doc.docstatus) === 1 ? this.frm.save('Update') : this.frm.save();
        }, this);
        
        if (this._allow_multiple) {
            var vals = toArray(this.value),
            last = vals.pop();
            each(vals, function(v) {
                this.frm.attachments.remove_attachment_by_filename(v);
            }, this);
            this.frm.attachments.remove_attachment_by_filename(last, callback);
        } else {
            this.frm.attachments.remove_attachment_by_filename(this.value, callback);
        }
	},
	on_attach_click: function() {
		this.set_upload_options();
		new frappe.ui.FileUploader(this.upload_options);
	},
	set_upload_options: function() {
		if (this.upload_options) return;
        
        this._parse_options();
        
        var options = {
            allow_multiple: false,
            on_success: fn(function(file) {
                this.on_upload_complete(file);
            }, this),
            restrictions: {}
        };
        if (this.frm) {
            options.doctype = this.frm.doctype;
            options.docname = this.frm.docname;
        }
        if (isPlainObject(this._options)) {
            Object.assign(options, this._options);
        }
        this.upload_options = this._images_only ? this._make_image_options(options) : options;
	},
	set_value: function(value, force_set_value=false) {
        return this._super(this._set_value(value), force_set_value);
    },
    set_input: function(value, dataurl) {
        if (!value) {
            this.value = null;
            clear(this._files);
            this._files_idx = 1;
            this.$input.toggle(true);
            this.$value.toggle(false);
            return;
        }
        
		var val = toArray(value, value, true);
        if (isArray(val)) {
            if (!this._allow_multiple) this.set_input(val[0] || null);
            else each(val, function(v) { this.set_input(v); }, this);
            return;
        }
        this.value = this._allow_multiple ? this._set_value(value) : value;
        
        this.$input.toggle(false);
        var filename = null;
		if (value.indexOf(",") !== -1) {
			var parts = value.split(",");
			filename = parts[0];
			dataurl = parts[1];
		}
		if (!filename) filename = dataurl ? value : value.split('/').pop();
		var $link = this.$value.toggle(true).find('.attached-file-link');
        if (this._allow_multiple) {
            var vals = toArray(this.value),
            file_name = filename;
            if (vals.length > 1) file_name = vals.length + ' ' + __('files uploaded');
            $link.html(file_name).attr('href', '#');
        } else {
            $link.html(filename).attr('href', dataurl || value);
        }
	},
	on_upload_complete: function(attachment) {
        this._add_file(attachment);
        
        if (this.frm) {
            this.parse_validate_and_set_in_model(this._set_value(attachment.file_url));
            this.frm.attachments.update_attachment(attachment);
            cint(this.frm.doc.docstatus) === 1 ? this.frm.save('Update') : this.frm.save();
        }
        this.set_value(attachment.file_url);
		this.refresh();
	},
	
    _parse_options: function() {
        if (!this._is_better) {
            this._is_better = true;
            this._latest_options = this.df.options;
            this._options = null;
            this._files = {};
            this._files_idx = 1;
            this._allow_multiple = false;
        }
        
        if (!this.df.options || this.df.options === this._latest_options) return;
        
        var options = parseJson(this.df.options);
        if (!isPlainObject(options)) return;
        
        this.df.options = this._latest_options = options;
        var opts = {restrictions: {}};
        each(
            [
                'upload_notes', 'allow_multiple', 'max_file_size',
                'allowed_file_types', 'max_number_of_files',
                'crop_image_aspect_ratio', 'as_public',
            ],
            function(k, i) {
                var v = this.df.options[k];
                if (v == null) return;
                if (i < 2) opts[k] = v;
                else {
                    if (i === 3 && v && !isArray(v)) {
                        v = isPlainObject(v) ? Object.values(v) : [v];
                    }
                    opts.restrictions[k] = v;
                }
            },
            this
        );
        this._options = opts;
        this._allow_multiple = opts.allow_multiple || false;
        
        var max_number_of_files = opts.restrictions.max_number_of_files || 0;
        if (this.frm && this._allow_multiple && max_number_of_files) {
            var meta = frappe.get_meta(this.frm.doctype);
            if (meta && max_number_of_files > (meta.max_attachments || 0)) {
                meta.max_attachments = max_number_of_files;
            }
            if (this.frm.meta && max_number_of_files > (this.frm.meta.max_attachments || 0)) {
                this.frm.meta.max_attachments = max_number_of_files;
            }
        }
    },
    _setup_display: function() {
        if (!this._allow_multiple) {
            if (this._images_only) this._setup_popover();
            return;
        }
        
        this._files_dialog = new frappe.ui.Dialog({
            title: this.df.label,
            indicator: 'blue',
        });
        this._files_dialog.set_primary_action(__('Close'), this._files_dialog.hide);
        this._files_dialog.get_primary_btn().removeClass('btn-primary').addClass('btn-danger');
        
        var wrapper = this._files_dialog.$wrapper.addClass('modal-dialog-scrollable'),
        body = wrapper.find('.modal-body'),
        container = $('<div class="container-fluid p-1"></div>').appendTo(body);
        this._files_row = $('<div class="row"></div>').appendTo(container);
        
        var me = this;
        this._files_row.on('click', 'div.ba-remove', function(e) {
            e.preventDefault();
            var idx = $(this).attr('data-file-idx');
            if (idx != null) {
                me._remove_file(cint(idx));
                $($(this).closest('div.ba-attachment').get(0)).remove();
            }
        });
        
        this.$value.find('a.attached-file-link')
        .on('click', function(e) {
            e.preventDefault();
            me._files_dialog.show();
        });
    },
    _setup_popover: function(dom, url) {
        dom = dom || this.$value.find('a.attached-file-link');
        url = url || this.value;
        $(dom).popover({
            trigger: 'hover',
            placement: 'top',
            content: function() {
                return `<div>
                    <img src="${url}" style="width:150px!important;height:auto;object-fit:contain"/>
                </div>`;
            },
            html: true
        });
    },
    _make_image_options: function(options) {
        var opts = deepClone(options),
        rest = opts.restrictions;
        if (rest.allowed_file_types == null) rest.allowed_file_types = [];
        else if (!isArray(rest.allowed_file_types)) rest.allowed_file_types = [rest.allowed_file_types];
        if (!rest.allowed_file_types.length) rest.allowed_file_types = ['image/*'];
        else rest.allowed_file_types = to_images_list(rest.allowed_file_types);
        if (!rest.crop_image_aspect_ratio) rest.crop_image_aspect_ratio = 1;
        return opts;
    },
    _set_value: function(value) {
        if (!this._allow_multiple) return value;
        var vals = toArray(this.value);
        if (vals.indexOf(value) >= 0) return this.value;
        vals.push(value);
        return toJson(vals);
    },
    _add_file: function(value) {
        var val = deepClone(value);
        val.name = val.file_name;
        val.url = val.file_url;
        val.class = !this._images_only ? get_icon_class(val.url) : 'image';
        val.is_image = this._images_only || val.class === 'image';
        if (val.is_image) {
            $('<img>', {
                src: val.url,
                onload: function() {
                    val.width = this.width;
                    val.height = this.height;
                }
            });
        }
        if (this.file_uploader) {
            each(this.file_uploader.uploader.files, function(f) {
                if (!f.file_obj || !f.doc || f.doc.file_url !== val.url) return;
                val.size = f.file_obj.size;
                val.size_str = formatSize(val.size);
                val.extension = f.file_obj.name.toLowerCase().split('.').pop();
                val.mime = f.file_obj.type.toLowerCase().split(';')[0];
                return false;
            });
        }
        this._add_file_to_dialog(val, this._files_idx);
        this._files[this._files_idx] = val;
        this._files_idx++;
    },
    _add_file_to_dialog: function(file, idx) {
        if (!this._allow_multiple) return;
        var meta = [];
        if (file.size_str) meta.push(__('Size') + ': ' + file.size_str);
        if (file.width && file.height) meta.push(__('Dimensions') + ': ' + file.width + 'x' + file.height);
        if (meta.length) {
            meta = meta.join('  -  ');
            meta = `<div class="d-block ba-meta mt-1">${meta}</div>`;
        } else {
            meta = '';
        }
        var dom = $(`
            <div class="col-12 p-1 ba-attachment">
                <div class="card">
                    <div class="card-body p-1">
                        <div class="row d-flex align-items-center">
                            <div class="col">
                                <div class="row">
                                    <div class="col-auto d-flex align-items-center">
                                        <div class="ba-file ba-${file.class}"></div>
                                    </div>
                                    <div class="col p-0 d-flex flex-column justify-content-center">
                                        <div class="d-block">
                                            <a href="${file.url}" class="ba-link ba-filename" target="__blank">
                                                <span class="fa fa-link ba-file-link"></span>
                                                ${file.name}
                                            </a>
                                        </div>
                                        ${meta}
                                    </div>
                                </div>
                            </div>
                            <div class="col-auto px-4 ba-remove" data-file-idx="${idx}">
                                <span class="fa fa-times fa-fw text-danger"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).appendTo(this._files_row);
        if (file.is_image) this._setup_popover(dom, file.url);
    },
    _remove_file: function(idx) {
        var file = this._files[idx].file_url;
        delete this._files[idx];
        
        var vals = toArray(this.value),
        i = vals.indexOf(file);
        if (i >= 0) {
            vals.splice(i, 1);
            this.value = toJson(vals);
        }
        
        if (!this.frm) {
            this.parse_validate_and_set_in_model(this.value);
            this.refresh();
            return;
        }
        
        this.frm.attachments.remove_attachment_by_filename(
            file,
            fn(function() {
                this.parse_validate_and_set_in_model(this.value);
                this.refresh();
                cint(this.frm.doc.docstatus) === 1 ? this.frm.save('Update') : this.frm.save();
            }, this)
        );
    }
});